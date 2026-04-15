import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Shield, Zap, Heart, Scroll, Star, Check,
  Copy, ExternalLink, ChevronRight, Medal, Users, Swords,
  TrendingUp, Calendar, Eye,
} from 'lucide-react';
import { getRankTier, getRankLabel } from '../utils/ranks';
import { ACHIEVEMENT_MAP } from '../utils/achievements';
import { apiUrl, cn, getProxiedUrl } from '../utils/utils';
import { ClanEmblem } from './clans/ClanEmblem';
import { useTranslation } from '../contexts/I18nContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicProfile {
  username: string;
  avatarUrl: string | null;
  createdAt: string | null;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    civilGames: number;
    stateGames: number;
    overseerGames: number;
    kills: number;
    deaths: number;
    elo: number;
    points: number;
    xp: number;
    agendasCompleted: number;
    civilWins: number;
    stateWins: number;
    overseerWins: number;
    rankedWins: number;
    rankedGames: number;
    casualWins: number;
    casualGames: number;
    classicWins: number;
    classicGames: number;
  };
  pinnedAchievements: string[];
  earnedAchievementsCount: number;
  activeFrame: string | null;
  activeBackground: string | null;
  clan: {
    id: string;
    tag: string;
    name: string;
    emblem: {
      iconId: string;
      iconColor: string;
      bgColor: string;
    };
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeRate(wins: number, played: number): number {
  if (!played) return 0;
  return Math.round((wins / played) * 100);
}

function formatKD(kills: number, deaths: number): string {
  if (!deaths) return kills > 0 ? `${kills}.0` : '—';
  return (kills / deaths).toFixed(2);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg bg-elevated animate-pulse', className)}
      style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
    />
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBar({
  label,
  wins,
  games,
  color,
  icon,
  delay = 0,
}: {
  label: string;
  wins: number;
  games: number;
  color: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  const pct = safeRate(wins, games);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200 + delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-secondary uppercase tracking-widest">
          {icon}
          {label}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-muted">{wins}W / {games}G</span>
          <span className={cn('text-sm font-bold font-mono tabular-nums', color)}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-card rounded-full overflow-hidden border border-subtle">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${pct}%` : 0 }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-elevated border border-subtle rounded-2xl p-4 flex flex-col gap-1.5">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest', accent ?? 'text-muted')}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-mono font-bold text-primary tabular-nums leading-none">{value}</div>
    </div>
  );
}

function PinnedAchievement({ id }: { id: string }) {
  const def = ACHIEVEMENT_MAP.get(id);
  if (!def) return null;

  const tierStyles: Record<string, { badge: string; glow: string; border: string }> = {
    Bronze: {
      badge: 'bg-amber-900/40 border-amber-700/60 text-amber-500',
      glow: 'shadow-amber-900/30',
      border: 'border-amber-800/40',
    },
    Silver: {
      badge: 'bg-slate-800/50 border-slate-500/60 text-slate-300',
      glow: 'shadow-slate-900/30',
      border: 'border-slate-700/30',
    },
    Gold: {
      badge: 'bg-yellow-900/40 border-yellow-500/60 text-yellow-400',
      glow: 'shadow-yellow-900/40',
      border: 'border-yellow-700/40',
    },
  };
  const ts = tierStyles[def.tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 bg-elevated border rounded-2xl p-3.5 shadow-lg',
        ts.border,
        ts.glow
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 text-xs font-mono font-bold uppercase',
          ts.badge
        )}
      >
        {def.tier[0]}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-primary uppercase tracking-wide truncate">{def.name}</div>
        <div className="text-[10px] text-muted leading-tight truncate">{def.description}</div>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlayerCard({ username }: { username: string }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const didFetch = useRef(false);

  // Set page meta
  useEffect(() => {
    document.title = `${username} — The Assembly`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = `${username}'s player profile on The Assembly. See their stats, rank, win rates, and achievements.`;
  }, [username]);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    fetch(apiUrl(`/api/public/player/${encodeURIComponent(username)}`))
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error('Player not found');
          throw new Error('Failed to load profile');
        }
        return r.json();
      })
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const rankTier = profile ? getRankTier(profile.stats.elo) : null;
  const winRate = profile ? safeRate(profile.stats.wins, profile.stats.gamesPlayed) : 0;

  return (
    <div
      className="min-h-screen bg-base text-primary font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, #0d0d1a 0%, #0a0a0a 60%)',
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6d28d9, transparent 70%)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1d4ed8, transparent 70%)', filter: 'blur(80px)' }}
        />
      </div>

      {/* Header bar */}
      <header
        className="sticky top-0 z-50 border-b border-subtle flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <a
          href="/"
          className="text-xs font-mono uppercase tracking-[0.3em] text-muted hover:text-primary transition-colors flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded bg-white/10 border border-subtle flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">A</span>
          </div>
          {t('common.title')}
        </a>
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-subtle hover:border-default"
        >
          {t('playercard.play_now')}
          <ChevronRight className="w-3 h-3" />
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Profile skeleton */}
              <div className="bg-elevated border border-subtle rounded-3xl p-6 flex items-center gap-5">
                <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/40 flex items-center justify-center">
                <Users className="w-8 h-8 text-red-500/60" />
              </div>
              <div>
                <div className="text-lg font-thematic tracking-wide text-primary">{t(`playercard.errors.${error.replace(/ /g, '_').toLowerCase()}`, { defaultValue: error })}</div>
                <div className="text-xs font-mono text-muted mt-1">
                  {error === 'Player not found'
                    ? t('playercard.errors.player_not_found_desc')
                    : t('playercard.errors.generic_desc')}
                </div>
              </div>
              <a
                href="/"
                className="mt-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-mono font-bold hover:bg-gray-200 transition-colors"
              >
                {t('playercard.join_assembly')}
              </a>
            </motion.div>
          )}

          {profile && !loading && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* ── Hero Card ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={cn(
                  'bg-elevated border rounded-3xl p-6 relative overflow-hidden shadow-2xl',
                  rankTier?.border ?? 'border-subtle'
                )}
              >
                {/* Rank glow */}
                <div
                  className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 80% 50%, ${
                       rankTier?.name === 'Diamond' ? '#93c5fd'
                       : rankTier?.name === 'Platinum' ? '#67e8f9'
                       : rankTier?.name === 'Gold' ? '#fbbf24'
                       : rankTier?.name === 'Silver' ? '#d1d5db'
                       : '#b45309'
                    }, transparent 70%)`,
                  }}
                />

                <div className="relative flex items-start gap-5">
                  {/* Avatar */}
                  <div className={cn('shrink-0 w-20 h-20 rounded-2xl border-2 overflow-hidden', rankTier?.border ?? 'border-subtle')}>
                    {profile.avatarUrl ? (
                      <img
                        src={getProxiedUrl(profile.avatarUrl)}
                        alt={profile.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-card flex items-center justify-center">
                        <span className="text-3xl font-thematic text-muted">
                          {profile.username[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted mb-0.5">
                      {t('playercard.player_profile')}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-thematic tracking-wide text-primary leading-tight break-all">
                        {profile.username}
                      </div>
                      {profile.clan && (
                        <a
                          href={`/clan/${profile.clan.tag}`}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-card border border-subtle hover:border-brand transition-colors group/clan"
                          title={`${profile.clan.name} [${profile.clan.tag}]`}
                        >
                          <ClanEmblem emblem={profile.clan.emblem} size="xs" />
                          <span className="text-[10px] font-mono font-bold text-ghost group-hover/clan:text-primary transition-colors">
                            {profile.clan.tag}
                          </span>
                        </a>
                      )}
                    </div>

                    {/* Rank badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xl leading-none">{rankTier?.icon}</span>
                      <span className={cn('text-sm font-thematic uppercase tracking-wide', rankTier?.color)}>
                        {getRankLabel(profile.stats.elo)}
                      </span>
                      <span className="text-xs font-mono text-muted">·</span>
                      <span className="text-xs font-mono text-secondary font-bold tabular-nums">{profile.stats.elo} {t('playercard.elo_label')}</span>
                    </div>

                    {/* ELO progress to next tier */}
                    {rankTier && (
                      <div className="mt-2.5 space-y-1">
                        <div className="h-1.5 bg-card rounded-full overflow-hidden border border-subtle max-w-[220px]">
                          <div
                            className={cn('h-full rounded-full transition-all', rankTier.bg.replace('/20', ''))}
                            style={{
                              width: `${rankTier.name === 'Diamond' ? 100 : Math.round(((profile.stats.elo - rankTier.minElo) / (rankTier.maxElo - rankTier.minElo)) * 100)}%`,
                            }}
                          />
                        </div>
                        {rankTier.name !== 'Diamond' && (
                          <div className="text-[9px] font-mono text-faint">
                            {t('playercard.elo_to_next', { amount: rankTier.maxElo - profile.stats.elo })}
                          </div>
                        )}
                      </div>
                    )}

                    {profile.createdAt && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-faint">
                        <Calendar className="w-3 h-3" />
                        {t('playercard.joined_on', { date: new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex gap-2 mt-5 relative">
                  <button
                    onClick={handleShare}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono uppercase tracking-widest transition-all',
                      copied
                        ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                        : 'bg-card border-subtle text-muted hover:text-primary hover:border-default'
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('playercard.copied') : t('playercard.share_profile')}
                  </button>
                  <a
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-mono uppercase tracking-widest hover:bg-gray-200 transition-colors font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('playercard.join_assembly')}
                  </a>
                </div>
              </motion.div>

              {/* ── Top Stats ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                <StatPill
                  label={t('playercard.stats.games')}
                  value={profile.stats.gamesPlayed}
                  icon={<Shield className="w-3 h-3" />}
                />
                <StatPill
                  label={t('playercard.stats.win_rate')}
                  value={`${winRate}%`}
                  icon={<Trophy className="w-3 h-3" />}
                  accent="text-yellow-500"
                />
                <StatPill
                  label={t('playercard.stats.kills')}
                  value={profile.stats.kills}
                  icon={<Zap className="w-3 h-3" />}
                  accent="text-red-400"
                />
                <StatPill
                  label={t('playercard.stats.kd_ratio')}
                  value={formatKD(profile.stats.kills, profile.stats.deaths)}
                  icon={<Swords className="w-3 h-3" />}
                />
              </motion.div>

              {/* ── Pinned Achievements ────────────────────────────────── */}
              {profile.pinnedAchievements.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Medal className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted">
                      {t('profile.tabs.achievements')}
                    </span>
                    <div className="flex-1 h-px bg-subtle" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {profile.pinnedAchievements.slice(0, 3).map((id) => (
                      <PinnedAchievement key={id} id={id} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Role Win Rates ────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-elevated border border-subtle rounded-3xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-muted" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted">
                    {t('playercard.stats.win_rate_role')}
                  </span>
                </div>
                <RoleBar
                  label={t('game.factions.civil.title')}
                  wins={profile.stats.civilWins}
                  games={profile.stats.civilGames}
                  color="text-sky-400"
                  icon={<Star className="w-3 h-3" />}
                  delay={0}
                />
                <RoleBar
                  label={t('game.factions.state.title')}
                  wins={profile.stats.stateWins}
                  games={profile.stats.stateGames}
                  color="text-red-400"
                  icon={<Eye className="w-3 h-3" />}
                  delay={100}
                />
                <RoleBar
                  label={t('game.factions.overseer.title')}
                  wins={profile.stats.overseerWins}
                  games={profile.stats.overseerGames}
                  color="text-violet-400"
                  icon={<Shield className="w-3 h-3" />}
                  delay={200}
                />
              </motion.div>

              {/* ── Mode Performance ──────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-elevated border border-subtle rounded-3xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-3.5 h-3.5 text-muted" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted">
                    {t('playercard.stats.perf_mode')}
                  </span>
                </div>
                <RoleBar
                  label={t('game.modes.ranked')}
                  wins={profile.stats.rankedWins}
                  games={profile.stats.rankedGames}
                  color="text-yellow-400"
                  icon={<Trophy className="w-3 h-3" />}
                  delay={50}
                />
                <RoleBar
                  label={t('game.modes.casual')}
                  wins={profile.stats.casualWins}
                  games={profile.stats.casualGames}
                  color="text-emerald-400"
                  icon={<Users className="w-3 h-3" />}
                  delay={150}
                />
                <RoleBar
                  label={t('game.modes.classic')}
                  wins={profile.stats.classicWins}
                  games={profile.stats.classicGames}
                  color="text-amber-400"
                  icon={<Star className="w-3 h-3" />}
                  delay={250}
                />
              </motion.div>

              {/* ── Detailed Stats ────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                <StatPill
                  label={t('playercard.stats.total_wins')}
                  value={profile.stats.wins}
                  icon={<Check className="w-3 h-3" />}
                  accent="text-emerald-400"
                />
                <StatPill
                  label={t('playercard.stats.agendas_done')}
                  value={profile.stats.agendasCompleted}
                  icon={<Scroll className="w-3 h-3" />}
                  accent="text-violet-400"
                />
                <StatPill
                  label={t('playercard.stats.deaths')}
                  value={profile.stats.deaths}
                  icon={<Heart className="w-3 h-3" />}
                  accent="text-red-400"
                />
                <StatPill
                  label={t('profile.stats.civil_games')}
                  value={profile.stats.civilGames}
                  icon={<Star className="w-3 h-3" />}
                  accent="text-sky-400"
                />
                <StatPill
                  label={t('profile.stats.state_games')}
                  value={profile.stats.stateGames}
                  icon={<Eye className="w-3 h-3" />}
                  accent="text-red-400"
                />
                <StatPill
                  label={t('profile.stats.overseer_games')}
                  value={profile.stats.overseerGames}
                  icon={<Shield className="w-3 h-3" />}
                  accent="text-violet-400"
                />
              </motion.div>

              {/* ── Achievements summary ──────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-elevated border border-subtle rounded-3xl p-5 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-yellow-900/20 border border-yellow-700/30 flex items-center justify-center shrink-0">
                  <Medal className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted mb-0.5">{t('playercard.stats.achievements')}</div>
                  <div className="text-xl font-mono font-bold text-primary">
                    {profile.earnedAchievementsCount}
                    <span className="text-sm text-muted font-normal ml-1">{t('playercard.stats.medals')}</span>
                  </div>
                </div>
              </motion.div>

              {/* ── Footer CTA ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center pt-4 pb-8 space-y-3"
              >
                <div className="text-xs font-mono text-muted uppercase tracking-widest">
                  {t('playercard.think_can_beat')}
                </div>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-2xl font-mono font-bold uppercase tracking-widest text-sm hover:bg-gray-200 transition-colors shadow-xl shadow-white/10"
                >
                  {t('playercard.join_assembly')}
                  <ChevronRight className="w-4 h-4" />
                </a>
                <div className="text-[10px] font-mono text-faint">{t('playercard.free_to_play')}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
