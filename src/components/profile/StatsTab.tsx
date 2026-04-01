import React from 'react';
import { Shield, Trophy, Check, Star, Flame, Zap, Heart, Scroll, Calendar } from 'lucide-react';
import { User } from '../../../shared/types';
import { getRankTier, getRankLabel } from '../../utils/ranks';
import { cn } from '../../utils/utils';

export const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) => (
  <div className="bg-elevated border border-subtle rounded-2xl p-6 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-ghost">
      {icon}
      <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-2xl font-serif italic text-primary">{value}</div>
  </div>
);

interface StatsTabProps {
  user: User;
}

export function StatsTab({ user }: StatsTabProps) {
  const winRate =
    user.stats.gamesPlayed > 0 ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Rank tier card */}
      <div
        className={cn(
          'bg-elevated border rounded-2xl p-6 flex flex-col gap-2 sm:col-span-2 lg:col-span-3',
          getRankTier(user.stats.elo).border
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">
              {getRankTier(user.stats.elo).icon}
            </span>
            <div>
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-0.5">
                Ranked Rating
              </div>
              <div
                className={cn(
                  'text-xl font-thematic uppercase tracking-wide leading-none',
                  getRankTier(user.stats.elo).color
                )}
              >
                {getRankLabel(user.stats.elo)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono text-primary font-bold">
              {user.stats.elo}
            </div>
            <div className="text-[10px] font-mono text-faint uppercase tracking-widest">
              ELO
            </div>
          </div>
        </div>
        {/* Progress bar to next tier */}
        {(() => {
          const tier = getRankTier(user.stats.elo);
          const span = tier.maxElo - tier.minElo;
          const pos = user.stats.elo - tier.minElo;
          const pct = tier.name === 'Diamond' ? 100 : Math.round((pos / span) * 100);
          const nextTier =
            tier.name === 'Diamond'
              ? null
              : ['Silver', 'Gold', 'Platinum', 'Diamond'][
                  ['Bronze', 'Silver', 'Gold', 'Platinum'].indexOf(tier.name)
                ];
          return (
            <div className="space-y-1">
              <div className="h-1.5 bg-card rounded-full overflow-hidden border border-subtle">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    tier.bg.replace('/20', '')
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {nextTier && (
                <div className="text-[9px] font-mono text-faint text-right">
                  {tier.maxElo - user.stats.elo} ELO to {nextTier}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      <StatCard
        label="Games Played"
        value={user.stats.gamesPlayed}
        icon={<Shield className="w-4 h-4" />}
      />
      <StatCard
        label="Win Rate"
        value={`${winRate}%`}
        icon={<Trophy className="w-4 h-4" />}
      />
      <StatCard
        label="Total Wins"
        value={user.stats.wins}
        icon={<Check className="w-4 h-4" />}
      />
      <StatCard
        label="Civil Games"
        value={user.stats.civilGames}
        icon={<Star className="w-4 h-4" />}
      />
      <StatCard
        label="State Games"
        value={user.stats.stateGames}
        icon={<Flame className="w-4 h-4" />}
      />
      <StatCard
        label="Overseer Games"
        value={user.stats.overseerGames}
        icon={<Shield className="w-4 h-4" />}
      />
      <StatCard
        label="Kills"
        value={user.stats.kills}
        icon={<Zap className="w-4 h-4 text-yellow-500" />}
      />
      <StatCard
        label="Deaths"
        value={user.stats.deaths}
        icon={<Heart className="w-4 h-4 text-red-500" />}
      />
      <StatCard
        label="Agendas Completed"
        value={user.stats.agendasCompleted || 0}
        icon={<Scroll className="w-4 h-4 text-emerald-500" />}
      />
      {user.createdAt && (
        <StatCard
          label="Account Created"
          value={new Date(user.createdAt).toLocaleDateString()}
          icon={<Calendar className="w-4 h-4 text-blue-500" />}
        />
      )}
    </div>
  );
}


