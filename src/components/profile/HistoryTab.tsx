import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { cn, apiUrl } from '../../lib/utils';
import { User, MatchSummary } from '../../types';

interface HistoryTabProps {
  user: User;
  token: string;
}

export function HistoryTab({ user, token }: HistoryTabProps) {
  const [matchHistory, setMatchHistory] = useState<MatchSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(apiUrl(`/api/match-history/${user.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMatchHistory(data.history || []);
    } catch {
      console.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-ghost font-mono text-xs uppercase tracking-widest">
        Loading match history...
      </div>
    );
  }

  if (matchHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Clock className="w-10 h-10 text-whisper" />
        <p className="text-ghost font-mono text-xs uppercase tracking-widest">
          No matches recorded yet
        </p>
        <p className="text-whisper text-xs italic">
          Your game history will appear here after your first game.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matchHistory.map((match) => {
        const isExpanded = expandedMatch === match.id;
        const date = new Date(match.playedAt);
        const dateStr = date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const timeStr = date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div
            key={match.id}
            className={cn(
              'rounded-2xl border overflow-hidden transition-colors',
              match.won
                ? 'border-emerald-900/40 bg-emerald-900/5'
                : 'border-red-900/30 bg-red-900/5'
            )}
          >
            {/* Match summary row */}
            <button
              onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
              className="w-full flex items-center gap-4 p-4 text-left"
            >
              {/* Win/loss indicator */}
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-thematic text-xs uppercase tracking-widest',
                  match.won
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40'
                    : 'bg-red-900/30 text-red-400 border border-red-700/40'
                )}
              >
                {match.won ? 'W' : 'L'}
              </div>

              {/* Core info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded border',
                      match.role === 'Civil'
                        ? 'text-blue-400 bg-blue-900/20 border-blue-900/40'
                        : match.role === 'Overseer'
                          ? 'text-red-500 bg-red-900/30 border-red-700/50 font-bold'
                          : 'text-red-400 bg-red-900/20 border-red-900/40'
                    )}
                  >
                    {match.role}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
                      match.mode === 'Ranked'
                        ? 'text-yellow-500 bg-yellow-900/10 border-yellow-900/30'
                        : match.mode === 'Classic'
                          ? 'text-emerald-500 bg-emerald-900/10 border-emerald-900/30'
                          : 'text-blue-400 bg-blue-900/10 border-blue-900/30'
                    )}
                  >
                    {match.mode}
                  </span>
                  <span className="text-faint text-xs font-mono">
                    {match.playerCount}p · R{match.rounds}
                  </span>
                </div>
                <div className="text-muted text-xs mt-0.5 truncate">
                  {match.winReason || (match.won ? 'Victory' : 'Defeat')}
                </div>
              </div>

              {/* Rewards */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="text-emerald-400 text-[10px] font-mono">
                  +{match.xpEarned} XP
                </span>
                <div className="flex gap-1.5">
                  {match.ipEarned > 0 && (
                    <span className="text-yellow-400 text-[10px] font-mono">
                      +{match.ipEarned} IP
                    </span>
                  )}
                  {match.cpEarned > 0 && (
                    <span className="text-purple-400 text-[10px] font-mono">
                      +{match.cpEarned} CP
                    </span>
                  )}
                </div>
              </div>

              {/* Expand chevron */}
              <div className="text-faint ml-1 shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Expanded details */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    {/* Policy track */}
                    <div className="flex gap-4">
                      <div className="flex-1 bg-surface rounded-xl p-3 border border-subtle">
                        <div className="text-faint text-[10px] font-mono uppercase tracking-widest mb-1">
                          Civil Track
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'w-5 h-5 rounded border',
                                  i < match.civilDirectives
                                    ? 'bg-blue-600 border-blue-500'
                                    : 'bg-card border-default'
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-blue-400 text-xs font-mono">
                            {match.civilDirectives}/5
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 bg-surface rounded-xl p-3 border border-subtle">
                        <div className="text-faint text-[10px] font-mono uppercase tracking-widest mb-1">
                          State Track
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'w-4 h-5 rounded border',
                                  i < match.stateDirectives
                                    ? 'bg-red-700 border-red-600'
                                    : 'bg-card border-default'
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-red-400 text-xs font-mono">
                            {match.stateDirectives}/6
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Personal agenda */}
                    {match.agendaName && (
                      <div
                        className={cn(
                          'rounded-xl p-3 border flex items-center gap-3',
                          match.agendaCompleted
                            ? 'bg-emerald-900/10 border-emerald-700/30'
                            : 'bg-surface border-subtle'
                        )}
                      >
                        <Target
                          className={cn(
                            'w-4 h-4 shrink-0',
                            match.agendaCompleted ? 'text-emerald-400' : 'text-faint'
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-faint text-[10px] font-mono uppercase tracking-widest">
                            Personal Agenda
                          </div>
                          <div
                            className={cn(
                              'text-xs font-medium',
                              match.agendaCompleted ? 'text-emerald-400' : 'text-tertiary'
                            )}
                          >
                            {match.agendaName} — {match.agendaCompleted ? 'Completed' : 'Failed'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date/time */}
                    <div className="text-ghost text-[10px] font-mono text-right">
                      {dateStr} at {timeStr}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
