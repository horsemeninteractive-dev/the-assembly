import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, Shield, Eye, Gamepad2, Target, Crown, Gavel,
  FileText, HeartPulse, TrendingUp, Zap, ThumbsDown,
  Skull, BookOpen, RefreshCw, CheckCircle2, Clock,
  Flame, Coins,
} from 'lucide-react';
import { User, ChallengesResponse, EnrichedChallenge } from '../../../shared/types';
import { cn, apiUrl } from '../../utils/utils';

// ---------------------------------------------------------------------------
// Icon map — matches the icon string field from ChallengeDef
// ---------------------------------------------------------------------------

const ICONS: Record<string, React.ReactNode> = {
  Trophy: <Trophy className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Eye: <Eye className="w-4 h-4" />,
  Gamepad2: <Gamepad2 className="w-4 h-4" />,
  Target: <Target className="w-4 h-4" />,
  Crown: <Crown className="w-4 h-4" />,
  Gavel: <Gavel className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  HeartPulse: <HeartPulse className="w-4 h-4" />,
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  ThumbsDown: <ThumbsDown className="w-4 h-4" />,
  Skull: <Skull className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
};

// ---------------------------------------------------------------------------
// Countdown helpers
// ---------------------------------------------------------------------------

function useCountdown(targetIso: string | undefined) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!targetIso) return;

    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setLabel('Now'); return; }

      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);

      if (h > 23) {
        const d = Math.floor(h / 24);
        setLabel(`${d}d ${h % 24}h`);
      } else if (h > 0) {
        setLabel(`${h}h ${m}m`);
      } else {
        setLabel(`${m}m ${s}s`);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return label;
}

// ---------------------------------------------------------------------------
// Single challenge card
// ---------------------------------------------------------------------------

function ChallengeCard({ challenge }: { challenge: EnrichedChallenge }) {
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const done = challenge.completed;

  const barColor =
    challenge.tier === 'Seasonal'
      ? 'bg-purple-500'
      : challenge.tier === 'Weekly'
        ? 'bg-blue-500'
        : 'bg-emerald-500';

  const borderColor = done
    ? challenge.tier === 'Seasonal'
      ? 'border-purple-500/40'
      : challenge.tier === 'Weekly'
        ? 'border-blue-500/40'
        : 'border-emerald-500/40'
    : 'border-subtle';

  const bgColor = done
    ? challenge.tier === 'Seasonal'
      ? 'bg-purple-900/10'
      : challenge.tier === 'Weekly'
        ? 'bg-blue-900/10'
        : 'bg-emerald-900/10'
    : 'bg-card';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        borderColor,
        bgColor
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
            done
              ? challenge.tier === 'Seasonal'
                ? 'bg-purple-900/30 border-purple-500/40 text-purple-400'
                : challenge.tier === 'Weekly'
                  ? 'bg-blue-900/30 border-blue-500/40 text-blue-400'
                  : 'bg-emerald-900/30 border-emerald-500/40 text-emerald-400'
              : 'bg-surface border-default text-muted'
          )}
        >
          {done
            ? <CheckCircle2 className="w-4 h-4" />
            : (ICONS[challenge.icon] ?? <Target className="w-4 h-4" />)}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={cn('text-sm font-semibold leading-tight', done ? 'text-muted line-through' : 'text-primary')}>
              {challenge.name}
            </p>
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-widest shrink-0',
              done ? 'text-muted' : 'text-faint'
            )}>
              {challenge.progress}/{challenge.target}
            </span>
          </div>
          <p className="text-xs text-tertiary leading-snug mb-3">{challenge.description}</p>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-full rounded-full', done ? 'opacity-50 ' + barColor : barColor)}
            />
          </div>

          {/* Rewards */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-mono text-yellow-400/80">
              <Flame className="w-2.5 h-2.5" />
              +{challenge.xpReward} XP
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400/80">
              <Coins className="w-2.5 h-2.5" />
              +{challenge.ipReward} IP
            </span>
            {done && (
              <span className="ml-auto text-[9px] font-mono text-muted uppercase tracking-widest">
                Claimed
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section header with countdown
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  resetsAt,
  color,
  count,
  total,
}: {
  label: string;
  resetsAt: string;
  color: string;
  count: number;
  total: number;
}) {
  const countdown = useCountdown(resetsAt);

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={cn('text-[10px] font-mono uppercase tracking-[0.2em] font-bold', color)}>
          {label}
        </span>
        <span className="text-[9px] font-mono text-faint">
          {count}/{total} complete
        </span>
      </div>
      <div className="flex items-center gap-1 text-[9px] font-mono text-faint">
        <Clock className="w-2.5 h-2.5" />
        {countdown}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

interface ChallengesTabProps {
  user: User;
  token: string;
}

export function ChallengesTab({ user, token }: ChallengesTabProps) {
  const [data, setData] = useState<ChallengesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/challenges'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load challenges');
      setData(await res.json());
    } catch {
      setError('Could not load challenges. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm font-mono">Loading challenges…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
        <p className="text-sm">{error || 'No challenge data available.'}</p>
        <button
          onClick={load}
          className="text-xs font-mono uppercase tracking-widest px-4 py-2 rounded-xl border border-default hover:bg-hover transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const dailyDone = data.daily.filter((c) => c.completed).length;
  const weeklyDone = data.weekly.filter((c) => c.completed).length;
  const seasonalDone = data.seasonal.filter((c) => c.completed).length;

  return (
    <div className="space-y-8">

      {/* Daily */}
      <section>
        <SectionHeader
          label="Daily"
          resetsAt={data.dailyResetsAt}
          color="text-emerald-400"
          count={dailyDone}
          total={data.daily.length}
        />
        <div className="space-y-3">
          {data.daily.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      </section>

      {/* Weekly */}
      <section>
        <SectionHeader
          label="Weekly"
          resetsAt={data.weeklyResetsAt}
          color="text-blue-400"
          count={weeklyDone}
          total={data.weekly.length}
        />
        <div className="space-y-3">
          {data.weekly.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      </section>

      {/* Seasonal */}
      {data.seasonal.length > 0 && (
        <section>
          <SectionHeader
            label="Seasonal"
            resetsAt={data.seasonEndsAt}
            color="text-purple-400"
            count={seasonalDone}
            total={data.seasonal.length}
          />
          <div className="space-y-3">
            {data.seasonal.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
