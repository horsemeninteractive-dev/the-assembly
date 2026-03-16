import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { User } from '../../../types';
import { getRankTier, getRankLabel } from '../../../lib/ranks';

interface LeaderboardModalProps {
  user: User;
  onClose: () => void;
}

export const LeaderboardModal = ({ user, onClose }: LeaderboardModalProps) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ELO' | 'Win%' | 'Games'>('ELO');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => { setLeaderboard(data); setLoading(false); })
      .catch(console.error);
  }, []);

  const sortedData = [...leaderboard].sort((a, b) => {
    if (activeTab === 'ELO')   return (b.stats.elo || 0) - (a.stats.elo || 0);
    if (activeTab === 'Win%') {
      const ra = (a.stats.gamesPlayed || 0) > 0 ? (a.stats.wins || 0) / a.stats.gamesPlayed : 0;
      const rb = (b.stats.gamesPlayed || 0) > 0 ? (b.stats.wins || 0) / b.stats.gamesPlayed : 0;
      return rb - ra;
    }
    return (b.stats.gamesPlayed || 0) - (a.stats.gamesPlayed || 0);
  });

  const currentUserRank = sortedData.findIndex(u => u.id === user.id) + 1;
  const currentUserData = sortedData.find(u => u.id === user.id);

  const positionDisplay = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const TABS: { id: 'ELO' | 'Win%' | 'Games'; color: string }[] = [
    { id: 'ELO',   color: 'border-yellow-500 text-primary' },
    { id: 'Win%',  color: 'border-emerald-500 text-primary' },
    { id: 'Games', color: 'border-blue-500 text-primary' },
  ];

  return (
    <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-default rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-thematic text-primary flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Ranked Leaderboard
          </h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-4 border-b border-default">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-2 border-b-2 font-mono text-sm uppercase tracking-widest transition-colors',
                activeTab === tab.id ? tab.color : 'border-transparent text-muted'
              )}
            >
              {tab.id}
            </button>
          ))}
        </div>

        {/* Column headers */}
        {!loading && (
          <div className="flex items-center gap-3 px-3 text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
            <div className="w-8 text-center shrink-0">#</div>
            <div className="flex-1">Player</div>
            {activeTab === 'ELO' && <div className="w-24 text-right shrink-0">Rank · ELO</div>}
            {activeTab !== 'ELO' && <div className="w-16 text-right shrink-0">{activeTab}</div>}
          </div>
        )}

        {/* List */}
        <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 mb-6">
          {loading ? (
            <div className="text-center text-muted py-10 font-mono text-sm">Loading...</div>
          ) : sortedData.map((u, i) => {
            const wins    = u.stats.wins || 0;
            const games   = u.stats.gamesPlayed || 0;
            const winRate = games > 0 ? ((wins / games) * 100).toFixed(1) : '0.0';
            const tier    = getRankTier(u.stats.elo || 1000);
            const isMe    = u.id === user.id;

            return (
              <div
                key={u.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  isMe ? 'bg-red-900/10 border-red-900/50' : 'bg-card border-subtle hover:border-default'
                )}
              >
                {/* Position */}
                <div className="w-8 text-center font-mono text-muted text-sm shrink-0">
                  {positionDisplay(i)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary text-sm truncate">{u.username}</div>
                  {isMe && <div className="text-[9px] font-mono text-faint uppercase tracking-widest">You</div>}
                </div>

                {/* Stat */}
                {activeTab === 'ELO' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm leading-none">{tier.icon}</span>
                    <div className="text-right">
                      <div className={cn('text-xs font-mono font-bold', tier.color)}>
                        {getRankLabel(u.stats.elo || 1000)}
                      </div>
                      <div className="text-[9px] font-mono text-faint">{u.stats.elo || 1000}</div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'font-mono text-right text-sm w-16 shrink-0',
                    activeTab === 'Win%' ? 'text-emerald-400' : 'text-blue-400'
                  )}>
                    {activeTab === 'Win%' ? `${winRate}%` : u.stats.gamesPlayed || 0}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Your rank footer */}
        {currentUserData && (
          <div className="pt-4 border-t border-default">
            <div className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">Your Position</div>
            <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-red-900/40">
              <div className="w-8 text-center font-mono text-muted text-sm shrink-0">#{currentUserRank}</div>
              <div className="flex-1 font-medium text-primary truncate text-sm">{currentUserData.username}</div>
              {activeTab === 'ELO' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm">{getRankTier(currentUserData.stats.elo || 1000).icon}</span>
                  <div className="text-right">
                    <div className={cn('text-xs font-mono font-bold', getRankTier(currentUserData.stats.elo || 1000).color)}>
                      {getRankLabel(currentUserData.stats.elo || 1000)}
                    </div>
                    <div className="text-[9px] font-mono text-faint">{currentUserData.stats.elo || 1000}</div>
                  </div>
                </div>
              ) : (
                <div className={cn('font-mono text-sm shrink-0', activeTab === 'Win%' ? 'text-emerald-400' : 'text-blue-400')}>
                  {activeTab === 'Win%'
                    ? `${((currentUserData.stats.wins || 0) / Math.max(1, currentUserData.stats.gamesPlayed || 1) * 100).toFixed(1)}%`
                    : currentUserData.stats.gamesPlayed || 0}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
