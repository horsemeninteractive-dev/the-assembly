import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy, Shield, Zap, Star } from 'lucide-react';
import { cn } from '../../../utils/utils';
import { User } from '../../../../shared/types';
import { getRankTier, getRankLabel } from '../../../utils/ranks';
import { RankIcon } from '../../icons';
import { getProxiedUrl, apiUrl } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface LeaderboardModalProps {
  user: User;
  onClose: () => void;
}

type ModeTab = 'Overall' | 'Ranked' | 'Casual' | 'Classic' | 'Crisis' | 'Betting';
type StatTab = 'Win%' | 'Games' | 'Wins' | 'ELO' | 'Profit';

const MODE_TABS: { id: ModeTab; labelKey: string; color: string; activeBg: string }[] = [
  { id: 'Overall', labelKey: 'profile.leaderboard.modes.overall', color: 'text-white', activeBg: 'bg-zinc-700 border-zinc-500' },
  {
    id: 'Ranked',
    labelKey: 'profile.leaderboard.modes.ranked',
    color: 'text-yellow-400',
    activeBg: 'bg-yellow-900/40 border-yellow-600/60',
  },
  {
    id: 'Casual',
    labelKey: 'profile.leaderboard.modes.casual',
    color: 'text-blue-400',
    activeBg: 'bg-blue-900/40 border-blue-600/60',
  },
  {
    id: 'Betting',
    labelKey: 'profile.leaderboard.modes.betting',
    color: 'text-indigo-400',
    activeBg: 'bg-indigo-900/40 border-indigo-600/60',
  },
  {
    id: 'Classic',
    labelKey: 'profile.leaderboard.modes.classic',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-900/40 border-emerald-600/60',
  },
  {
    id: 'Crisis',
    labelKey: 'profile.leaderboard.modes.crisis',
    color: 'text-purple-400',
    activeBg: 'bg-purple-900/40 border-purple-600/60',
  },
];

const positionDisplay = (index: number) => {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
};

export const LeaderboardModal = ({ user, onClose }: LeaderboardModalProps) => {
  const { t } = useTranslation();
  const [boards, setBoards] = useState<Record<string, any[]>>({
    overall: [],
    ranked: [],
    casual: [],
    classic: [],
    crisis: [],
    betting: [],
  });
  const [loading, setLoading] = useState(true);
  const [modeTab, setModeTab] = useState<ModeTab>('Overall');
  const [statTab, setStatTab] = useState<StatTab>('ELO');
  const [showSeasonHistory, setShowSeasonHistory] = useState(false);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasonBoard, setSeasonBoard] = useState<any[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/leaderboard'))
      .then((res) => res.json())
      .then((data) => {
        setBoards(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(apiUrl('/api/seasons'))
      .then(res => res.json())
      .then(data => {
        setSeasons(data);
        if (data.length > 0) setSelectedSeason(data[0]);
      });
  }, []);

  useEffect(() => {
    if (showSeasonHistory && selectedSeason) {
      setSeasonLoading(true);
      fetch(apiUrl(`/api/leaderboard/season/${encodeURIComponent(selectedSeason)}`))
        .then(res => res.json())
        .then(data => {
          setSeasonBoard(data);
          setSeasonLoading(false);
        })
        .catch(() => setSeasonLoading(false));
    }
  }, [showSeasonHistory, selectedSeason]);

  // When mode changes, set a sensible default stat
  useEffect(() => {
    if (modeTab === 'Ranked') setStatTab('ELO');
    else if (modeTab === 'Overall') setStatTab('Wins');
    else if (modeTab === 'Betting') setStatTab('Profit');
    else setStatTab('Win%');
  }, [modeTab]);

  const activeModeConfig = MODE_TABS.find((m) => m.id === modeTab)!;

  const rawData: any[] = showSeasonHistory ? seasonBoard : boards[modeTab.toLowerCase()] ?? [];

  // Which stats to offer based on mode
  const availableStats: StatTab[] =
    modeTab === 'Ranked' || modeTab === 'Overall'
      ? ['ELO', 'Win%', 'Wins', 'Games']
      : modeTab === 'Betting'
      ? ['Profit', 'Wins']
      : ['Win%', 'Wins', 'Games'];

  const getStatValue = (u: any, stat: StatTab): number => {
    if (showSeasonHistory) {
      switch (stat) {
        case 'ELO': return u.elo ?? 1000;
        case 'Wins': return u.rankedWins ?? 0;
        case 'Games': return u.rankedGames ?? 0;
        case 'Win%': return u.rankedGames > 0 ? (u.rankedWins / u.rankedGames) * 100 : 0;
        default: return 0;
      }
    }
    const mode = modeTab.toLowerCase();
    switch (stat) {
      case 'ELO':
        return u.stats?.elo ?? 1000;
      case 'Profit':
        return u.stats?.bettingPoints ?? 0;
      case 'Wins':
        if (modeTab === 'Overall') return u.stats?.wins ?? 0;
        if (mode === 'betting') return u.stats?.bettingWins ?? 0;
        return u.stats?.[`${mode}Wins`] ?? 0;
      case 'Games':
        if (modeTab === 'Overall') return u.stats?.gamesPlayed ?? 0;
        return u.stats?.[`${mode}Games`] ?? 0;
      case 'Win%': {
        const wins = modeTab === 'Overall' ? (u.stats?.wins ?? 0) : (u.stats?.[`${mode}Wins`] ?? 0);
        const games =
          modeTab === 'Overall' ? (u.stats?.gamesPlayed ?? 0) : (u.stats?.[`${mode}Games`] ?? 0);
        return games > 0 ? (wins / games) * 100 : 0;
      }
    }
    return 0;
  };

  const sortedData = [...rawData].sort(
    (a, b) => getStatValue(b, statTab) - getStatValue(a, statTab)
  );
  const currentUserRank = sortedData.findIndex((u) => u.id === user.id) + 1;
  const currentUserData = sortedData.find((u) => u.id === user.id);

  const formatStat = (u: any, stat: StatTab) => {
    const val = getStatValue(u, stat);
    if (stat === 'Win%') return `${val.toFixed(1)}%`;
    if (stat === 'ELO') return val.toString();
    if (stat === 'Profit') return `${val} IP`;
    return val.toString();
  };

  const statColor = (stat: StatTab) => {
    if (stat === 'ELO') return 'text-yellow-400';
    if (stat === 'Win%') return 'text-emerald-400';
    if (stat === 'Wins') return 'text-blue-400';
    if (stat === 'Profit') return 'text-indigo-400';
    return 'text-purple-400';
  };

  const currentLoading = showSeasonHistory ? seasonLoading : loading;

  return (
    <div className="fixed inset-0 bg-backdrop backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-glass border border-default rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-thematic text-primary flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            {t('profile.leaderboard.title')}
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowSeasonHistory(!showSeasonHistory);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest border transition-all flex items-center gap-2",
                showSeasonHistory 
                  ? "bg-primary text-black border-primary shadow-lg shadow-primary/20" 
                  : "bg-surface-glass text-muted border-subtle hover:text-white"
              )}
            >
              <Zap className={cn("w-3 h-3", showSeasonHistory ? "fill-black" : "")} />
              {t('season.leaderboard.historical')}
            </button>
            <button onClick={onClose} className="p-2 text-muted hover:text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Season Selector Dropdown */}
        {showSeasonHistory && seasons.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-4 p-3 bg-base/50 rounded-xl border border-subtle">
            <span className="text-xs font-mono text-muted uppercase tracking-[0.2em] pl-1">
              {t('season.leaderboard.title')}
            </span>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-elevated border border-subtle rounded-lg px-3 py-1.5 text-xs text-primary focus:border-primary outline-none custom-select"
            >
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Mode Tabs (tier 1) */}
        {!showSeasonHistory && (
          <div className="flex gap-1 p-1 bg-surface-glass/40 rounded-xl border border-subtle mb-3 backdrop-blur-sm">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setModeTab(tab.id)}
                className={cn(
                  'flex-1 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all border',
                  modeTab === tab.id
                    ? cn(tab.activeBg, tab.color)
                    : 'border-transparent text-muted hover:text-ghost'
                )}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        )}

        {/* Stat Tabs (tier 2) */}
        {!showSeasonHistory && (
          <div className="flex gap-3 border-b border-default mb-3">
            {availableStats.map((stat) => (
              <button
                key={stat}
                onClick={() => setStatTab(stat)}
                className={cn(
                  'pb-2 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors',
                  statTab === stat
                    ? cn('border-current', statColor(stat))
                    : 'border-transparent text-muted hover:text-ghost'
                )}
              >
                {stat === 'Win%' ? t('profile.leaderboard.stats.win_rate') :
                 stat === 'Games' ? t('profile.leaderboard.stats.games') :
                 stat === 'Wins' ? t('profile.leaderboard.stats.wins') :
                 stat === 'Profit' ? t('profile.leaderboard.stats.profit') :
                 t('profile.leaderboard.stats.elo')}
              </button>
            ))}
          </div>
        )}

        {/* Column headers */}
        {!currentLoading && (
          <div className="flex items-center gap-3 px-3 text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
            <div className="w-8 text-center shrink-0">#</div>
            <div className="flex-1">{t('profile.leaderboard.column_player')}</div>
            {(statTab === 'ELO' || showSeasonHistory) && <div className="w-28 text-right shrink-0">{t('profile.leaderboard.column_rank_elo')}</div>}
            {statTab !== 'ELO' && !showSeasonHistory && <div className="w-16 text-right shrink-0">
              {statTab === 'Win%' ? t('profile.leaderboard.stats.win_rate') :
               statTab === 'Games' ? t('profile.leaderboard.stats.games') :
               statTab === 'Profit' ? t('profile.leaderboard.stats.profit') :
               t('profile.leaderboard.stats.wins')}
            </div>}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-thin bg-black/20 rounded-b-xl border border-t-0 border-subtle">
          {currentLoading ? (
            <div className="text-center text-muted py-10 font-mono text-sm">{t('profile.leaderboard.loading')}</div>
          ) : sortedData.length === 0 ? (
            <div className="text-center text-muted py-10 font-mono text-xs">
              {t('profile.leaderboard.no_data', { mode: t(activeModeConfig.labelKey) })}
            </div>
          ) : (
            sortedData.map((u, i) => {
              const tier = getRankTier(u.stats?.elo ?? 1000);
              const isMe = u.id === user.id;
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                    isMe
                      ? 'bg-red-900/10 border-red-900/50'
                      : 'bg-surface-glass/40 border-subtle hover:border-default hover:bg-surface-glass/60'
                  )}
                >
                  <div className="w-8 text-center font-mono text-muted text-sm shrink-0">
                    {positionDisplay(i)}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {u.avatarUrl && (
                      <img
                        src={getProxiedUrl(u.avatarUrl)}
                        alt={u.username}
                        className="w-6 h-6 rounded-lg object-cover shrink-0 border border-default"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-primary text-sm truncate">{u.username}</div>
                      {isMe && (
                        <div className="text-[9px] font-mono text-faint uppercase tracking-widest">
                          {t('profile.leaderboard.you')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stat value */}
                  {statTab === 'ELO' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <RankIcon tier={tier.name} className="w-4 h-4 shrink-0" />
                      <div className="text-right">
                        <div className={cn('text-xs font-mono font-bold', tier.color)}>
                          {getRankLabel(u.stats?.elo ?? 1000)}
                        </div>
                        <div className="text-[9px] font-mono text-faint">
                          {u.stats?.elo ?? 1000}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'font-mono text-right text-sm w-16 shrink-0',
                        statColor(statTab)
                      )}
                    >
                      {formatStat(u, statTab)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Your rank footer */}
        {currentUserData && (
          <div className="pt-3 border-t border-default">
            <div className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
              {t('profile.leaderboard.your_position')}
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-glass/60 rounded-xl border border-red-900/40 backdrop-blur-sm">
              <div className="w-8 text-center font-mono text-muted text-sm shrink-0">
                #{currentUserRank}
              </div>
              <div className="flex-1 font-medium text-primary truncate text-sm">
                {currentUserData.username}
              </div>
              {statTab === 'ELO' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <RankIcon tier={getRankTier(currentUserData.stats?.elo ?? 1000).name} className="w-5 h-5 shrink-0" />
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-xs font-mono font-bold',
                        getRankTier(currentUserData.stats?.elo ?? 1000).color
                      )}
                    >
                      {getRankLabel(currentUserData.stats?.elo ?? 1000)}
                    </div>
                    <div className="text-[9px] font-mono text-faint">
                      {currentUserData.stats?.elo ?? 1000}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn('font-mono text-sm shrink-0', statColor(statTab))}>
                  {formatStat(currentUserData, statTab)}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};


