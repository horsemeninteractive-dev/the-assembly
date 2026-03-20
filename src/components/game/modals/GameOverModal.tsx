import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scroll, Target, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, Trophy, Zap, Coins, Medal } from 'lucide-react';
import { GameState, PrivateInfo, PostMatchResult } from '../../../types';
import { cn, getProxiedUrl } from '../../../lib/utils';
import { OverseerIcon } from '../../icons';
import { getLevelFromXp, getXpForNextLevel, getXpInCurrentLevel } from '../../../lib/xp';
import { getRankTier, getRankLabel } from '../../../lib/ranks';
import { ACHIEVEMENT_MAP, AchievementDef } from '../../../lib/achievements';

interface GameOverModalProps {
  gameState: GameState;
  privateInfo: PrivateInfo | null;
  myId: string | undefined;
  postMatchResult: PostMatchResult | null;
  onPlayAgain: () => void;
  onLeave: () => void;
  onOpenLog: () => void;
}

const TIER_COLOURS: Record<string, string> = {
  Bronze: 'text-amber-600  border-amber-700/40  bg-amber-900/20',
  Silver: 'text-slate-300  border-slate-500/40  bg-slate-800/30',
  Gold:   'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
};

const EloChange = ({ change }: { change: number }) => {
  if (change === 0) return (
    <span className="flex items-center gap-1 text-muted font-mono text-sm">
      <Minus className="w-3.5 h-3.5" /> 0
    </span>
  );
  const positive = change > 0;
  return (
    <span className={cn('flex items-center gap-1 font-mono text-sm font-bold', positive ? 'text-emerald-400' : 'text-red-400')}>
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {positive ? '+' : ''}{change}
    </span>
  );
};

export const GameOverModal = ({ gameState, privateInfo, myId, postMatchResult, onPlayAgain, onLeave, onOpenLog }: GameOverModalProps) => {
  const agenda          = privateInfo?.personalAgenda;
  const agendaCompleted = agenda?.status === 'completed';
  const agendaFailed    = agenda?.status === 'failed';

  const isRanked = postMatchResult?.mode === 'Ranked';
  const xpAfter  = postMatchResult ? undefined : undefined; // we don't have the full xp value here, use userUpdate

  return (
    <AnimatePresence>
      {gameState.phase === 'GameOver' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute inset-0 z-[50] bg-backdrop backdrop-blur-md flex items-center justify-center p-4 pb-16"
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="max-w-md w-full bg-surface border border-default rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-full"
          >
            {/* Win banner */}
            <div className={cn(
              'p-[3vh] text-center border-b border-subtle',
              gameState.winner === 'Civil' ? 'bg-blue-900/20' : gameState.winner === 'State' ? 'bg-red-900/20' : 'bg-surface'
            )}>
              <div className={cn(
                'text-responsive-2xl font-thematic tracking-widest uppercase mb-1',
                gameState.winner === 'Civil' ? 'text-blue-400' : gameState.winner === 'State' ? 'text-red-500' : 'text-muted'
              )}>
                {gameState.winner === 'Civil'
                  ? gameState.winReason || 'Charter Restored'
                  : gameState.winner === 'State'
                    ? gameState.winReason || 'State Supremacy'
                    : 'Inconclusive'}
              </div>
              <p className="text-responsive-xs text-muted font-mono uppercase tracking-[0.2em]">
                {gameState.winner === 'Civil'
                  ? 'The Charter has been defended.'
                  : gameState.winner === 'State'
                    ? 'The Secretariat has fallen to the State.'
                    : 'The Assembly has collapsed due to a disconnection.'}
              </p>
            </div>

            {/* Scrollable middle content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-[3vh] space-y-[2vh]">

                {/* ── Post-match ELO summary (ranked only) ────────────────── */}
                {postMatchResult && (
                  <div className={cn(
                    'rounded-2xl border p-4',
                    postMatchResult.won
                      ? 'bg-emerald-900/10 border-emerald-700/30'
                      : 'bg-red-900/10 border-red-700/30'
                  )}>
                    {/* Result headline */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn(
                        'text-sm font-thematic uppercase tracking-widest',
                        postMatchResult.won ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {postMatchResult.won ? 'Victory' : 'Defeat'}
                      </span>
                      <span className="text-[10px] font-mono text-faint uppercase tracking-widest">
                        {postMatchResult.mode} · {postMatchResult.role}
                      </span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* ELO change — only show for ranked */}
                      {isRanked ? (
                        <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                          <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                            <Trophy className="w-3 h-3" /> ELO
                          </div>
                          <EloChange change={postMatchResult.eloChange} />
                          <div className="text-[9px] font-mono text-faint mt-0.5">
                            <span className={getRankTier(postMatchResult.eloBefore).color}>{getRankLabel(postMatchResult.eloBefore)}</span>
                            {postMatchResult.eloChange !== 0 && (
                              <> → <span className={getRankTier(postMatchResult.eloAfter).color}>{getRankLabel(postMatchResult.eloAfter)}</span></>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                          <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                            <Trophy className="w-3 h-3" /> ELO
                          </div>
                          <span className="text-muted text-xs font-mono">Casual</span>
                        </div>
                      )}

                      {/* XP earned */}
                      <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                        <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Zap className="w-3 h-3" /> XP
                        </div>
                        <span className="text-yellow-400 font-mono text-sm font-bold">+{postMatchResult.xpEarned}</span>
                      </div>

                      {/* IP earned */}
                      <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                        <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Coins className="w-3 h-3" /> IP
                        </div>
                        <span className="text-emerald-400 font-mono text-sm font-bold">+{postMatchResult.ipEarned}</span>
                      </div>
                    </div>

                    {/* Room average ELO — ranked only */}
                    {isRanked && (
                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-faint px-1">
                        <span>Room avg ELO</span>
                        <span className="text-secondary">{postMatchResult.roomAverageElo}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Log button ─────────────────────────────────────────── */}
                <button
                  onClick={onOpenLog}
                  className="w-full py-[1vh] bg-card text-tertiary border border-default rounded-xl hover:bg-hover hover:text-primary transition-all font-mono text-responsive-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Scroll className="w-[2vh] h-[2vh]" />
                  View Assembly Log
                </button>

                {/* ── Personal Agenda result ──────────────────────────────── */}
                {agenda && (
                  <div className={cn(
                    'rounded-xl border p-[1.5vh]',
                    agendaCompleted ? 'bg-emerald-900/15 border-emerald-500/30' :
                    agendaFailed    ? 'bg-red-900/15 border-red-500/20' :
                                      'bg-card border-default'
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Target className={cn(
                          'w-[2vh] h-[2vh] shrink-0 mt-0.5',
                          agendaCompleted ? 'text-emerald-400' : agendaFailed ? 'text-red-400' : 'text-muted'
                        )} />
                        <div className="min-w-0">
                          <div className="text-responsive-xs uppercase tracking-widest text-muted font-mono mb-0.5">Personal Agenda</div>
                          <div className="text-responsive-sm font-bold text-primary uppercase tracking-wide">{agenda.name}</div>
                          <div className="text-responsive-xs text-tertiary leading-tight mt-0.5">{agenda.description}</div>
                        </div>
                      </div>
                      <div className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-full shrink-0 text-[10px] font-mono uppercase tracking-widest border',
                        agendaCompleted ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-400' :
                        agendaFailed    ? 'bg-red-900/30 border-red-500/40 text-red-400' :
                                          'bg-subtle border-strong text-tertiary'
                      )}>
                        {agendaCompleted
                          ? <><CheckCircle className="w-3 h-3" /><span>Complete</span></>
                          : agendaFailed
                            ? <><XCircle className="w-3 h-3" /><span>Failed</span></>
                            : <span>—</span>}
                      </div>
                    </div>
                    {agendaCompleted && (
                      <div className="mt-[1vh] pl-[2.5vh] text-[10px] text-emerald-400/70 font-mono">
                        +100 XP · Bonus IP awarded
                      </div>
                    )}
                  </div>
                )}

                {/* ── Newly unlocked achievements ─────────────────────── */}
                {postMatchResult && postMatchResult.newAchievements.length > 0 && (() => {
                  const defs = postMatchResult.newAchievements
                    .map(id => ACHIEVEMENT_MAP.get(id))
                    .filter((d): d is AchievementDef => !!d);
                  return (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-[1.5vh]">
                      <div className="flex items-center gap-2 mb-2">
                        <Medal className="w-[2vh] h-[2vh] text-yellow-400 shrink-0" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-yellow-400">
                          Achievement{defs.length > 1 ? 's' : ''} Unlocked
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {defs.map(def => (
                          <motion.div
                            key={def.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-[11px]',
                              TIER_COLOURS[def.tier]
                            )}
                          >
                            <span className="font-bold tracking-wide uppercase">{def.name}</span>
                            <span className="text-faint ml-auto font-mono whitespace-nowrap">
                              +{def.xpReward} XP · +{def.ipReward} IP
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Identity reveal ─────────────────────────────────────── */}
                <div className="space-y-[2vh]">
                  <div className="text-responsive-xs uppercase tracking-[0.2em] text-ghost font-mono border-b border-subtle pb-2 flex justify-between">
                    <span>Final Identity Reveal</span>
                    <span>Secret Identity</span>
                  </div>
                  <div className="space-y-[1vh]">
                    {gameState.players.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-[1vh] border-b border-subtle/30">
                        <div className="flex items-center gap-3">
                          <div className="w-[4vh] h-[4vh] rounded-full bg-card flex items-center justify-center text-responsive-xs text-muted font-mono overflow-hidden border border-default">
                            {p.avatarUrl
                              ? <img src={getProxiedUrl(p.avatarUrl)} alt={p.name} className="w-full h-full object-cover" />
                              : p.name.charAt(0)}
                          </div>
                          <span className="text-responsive-sm text-primary font-medium">{p.name.replace(' (AI)', '')}</span>
                        </div>
                        <div className={cn(
                          'px-3 py-1 rounded-lg border text-responsive-xs font-mono uppercase tracking-widest',
                          p.role === 'Civil'    ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                          p.role === 'State'    ? 'bg-red-900/20 border-red-500/30 text-red-500' :
                          'bg-red-900/40 border-red-500 text-red-400 font-bold'
                        )}>
                          {p.role === 'Civil' ? 'Civil' : p.role === 'State' ? 'State' : 'The Overseer'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Pinned action buttons */}
            <div className="flex gap-3 p-[3vh] pt-0 shrink-0">
              <button
                onClick={onPlayAgain}
                className="flex-1 py-[1.5vh] btn-primary rounded-xl hover:bg-subtle transition-all font-thematic text-responsive-sm uppercase tracking-widest"
              >
                Play Again
              </button>
              <button
                onClick={onLeave}
                className="flex-1 py-[1.5vh] bg-card text-primary rounded-xl hover:bg-subtle transition-all font-thematic text-responsive-sm uppercase tracking-widest border border-default"
              >
                Lobby
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
