import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scroll,
  Target,
  Shield,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Zap,
  Coins,
  Medal,
  Flame,
} from 'lucide-react';
import { GameState, PrivateInfo, PostMatchResult } from '../../../../shared/types';
import { cn, getProxiedUrl } from '../../../utils/utils';
import { OverseerIcon } from '../../icons';
import { getLevelFromXp, getXpForNextLevel, getXpInCurrentLevel } from '../../../utils/xp';
import { getRankTier, getRankLabel } from '../../../utils/ranks';
import { ACHIEVEMENT_MAP, AchievementDef } from '../../../utils/achievements';

interface GameOverModalProps {
  gameState: GameState;
  privateInfo: PrivateInfo | null;
  myId: string | undefined;
  postMatchResult: PostMatchResult | null;
  onPlayAgain: () => void;
  onLeave: () => void;
  onOpenLog: () => void;
  playSound: (key: string) => void;
}

const TIER_COLOURS: Record<string, string> = {
  Bronze: 'text-amber-600  border-amber-700/40  bg-amber-900/20',
  Silver: 'text-slate-300  border-slate-500/40  bg-slate-800/30',
  Gold: 'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
};

const EloChange = ({ change }: { change: number }) => {
  if (change === 0)
    return (
      <span className="flex items-center gap-1 text-muted font-mono text-sm">
        <Minus className="w-3.5 h-3.5" /> 0
      </span>
    );
  const positive = change > 0;
  return (
    <span
      className={cn(
        'flex items-center gap-1 font-mono text-sm font-bold',
        positive ? 'text-emerald-400' : 'text-red-400'
      )}
    >
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {positive ? '+' : ''}
      {change}
    </span>
  );
};

export const GameOverModal = ({
  gameState,
  privateInfo,
  myId,
  postMatchResult,
  onPlayAgain,
  onLeave,
  onOpenLog,
  playSound,
}: GameOverModalProps) => {
  const agenda = privateInfo?.personalAgenda;
  const agendaCompleted = agenda?.status === 'completed';
  const agendaFailed = agenda?.status === 'failed';

  const isRanked = postMatchResult?.mode === 'Ranked';
  const xpAfter = postMatchResult ? undefined : undefined; // we don't have the full xp value here, use userUpdate

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
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-sm lg:max-w-5xl bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[82vh] lg:max-h-[80vh] mt-[5vh] lg:mt-[5vh] backdrop-blur-2xl"
          >
            {/* Win banner */}
            <div
              className={cn(
                'p-[3vh] text-center',
                gameState.winner === 'Civil'
                  ? 'bg-blue-900/20'
                  : gameState.winner === 'State'
                    ? 'bg-red-900/20'
                    : 'bg-surface'
              )}
            >
              <div
                className={cn(
                  'text-[4vh] lg:text-[5vh] font-thematic tracking-[0.15em] uppercase mb-1 leading-tight',
                  gameState.winner === 'Civil'
                    ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                    : gameState.winner === 'State'
                      ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'text-muted'
                )}
              >
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

            {/* Split Content Area for Desktop, Scrollable Single Area for Mobile */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-visible custom-scrollbar">
              {/* Left Column: Match Summary & Progress */}
              <div className="lg:w-1/2 lg:basis-1/2 lg:overflow-y-auto custom-scrollbar p-[3vh] space-y-[2.5vh] shrink-0">
                <div className="text-responsive-xs uppercase tracking-[0.2em] text-muted font-mono border-b border-subtle/30 pb-2 flex justify-between items-center">
                  <span>Match Performance</span>
                </div>

                {/* ── Post-match ELO summary ────────────────── */}
                {postMatchResult && (
                  <div
                    className={cn(
                      'rounded-2xl border p-4 shadow-inner',
                      postMatchResult.won
                        ? 'bg-emerald-900/10 border-emerald-700/30 backdrop-blur-sm'
                        : 'bg-red-900/10 border-red-700/30 backdrop-blur-sm'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={cn(
                          'text-sm font-thematic uppercase tracking-widest',
                          postMatchResult.won ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {postMatchResult.won ? 'Victory Achieved' : 'Mission Failed'}
                      </span>
                      <span className="text-[10px] font-mono text-faint uppercase tracking-widest">
                        {postMatchResult.mode} · {postMatchResult.role}
                      </span>
                    </div>

                    <div className={cn("grid gap-2", postMatchResult.clanXpEarned ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
                      {isRanked ? (
                        <div className="bg-surface-glass/40 rounded-xl p-2.5 text-center border border-subtle">
                          <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                            <Trophy className="w-3 h-3" /> ELO
                          </div>
                          <EloChange change={postMatchResult.eloChange} />
                          <div className="text-[9px] font-mono text-faint mt-0.5">
                            <span className={getRankTier(postMatchResult.eloBefore).color}>
                              {getRankLabel(postMatchResult.eloBefore)}
                            </span>
                            {postMatchResult.eloChange !== 0 && (
                              <>
                                {' '}
                                →{' '}
                                <span className={getRankTier(postMatchResult.eloAfter).color}>
                                  {getRankLabel(postMatchResult.eloAfter)}
                                </span>
                              </>
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

                      <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                        <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Flame className="w-3 h-3" /> XP
                        </div>
                        <span className="text-yellow-400 font-mono text-sm font-bold">
                          +{postMatchResult.xpEarned}
                        </span>
                      </div>

                      <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                        <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Coins className="w-3 h-3" /> IP
                        </div>
                        <span className="text-emerald-400 font-mono text-sm font-bold">
                          +{postMatchResult.ipEarned}
                        </span>
                      </div>

                      {postMatchResult.clanXpEarned !== undefined && postMatchResult.clanXpEarned > 0 && (
                        <div className="bg-surface/50 rounded-xl p-2.5 text-center border border-subtle">
                          <div className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                            <Shield className="w-3 h-3" /> Clan XP
                          </div>
                          <span className="text-blue-400 font-mono text-sm font-bold">
                            +{postMatchResult.clanXpEarned}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {agenda && (
                  <div
                    className={cn(
                      'rounded-2xl border p-[1.5vh]',
                      agendaCompleted
                        ? 'bg-emerald-900/15 border-emerald-500/30'
                        : agendaFailed
                          ? 'bg-red-900/15 border-red-500/20'
                          : 'bg-card border-default'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Target
                          className={cn(
                            'w-[2vh] h-[2vh] shrink-0 mt-1',
                            agendaCompleted
                              ? 'text-emerald-400'
                              : agendaFailed
                                ? 'text-red-400'
                                : 'text-muted'
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-responsive-xs uppercase tracking-widest text-muted font-mono mb-0.5">
                            Personal Agenda
                          </div>
                          <div className="text-responsive-sm font-bold text-primary uppercase tracking-wide">
                            {agenda.name}
                          </div>
                          <div className="text-responsive-xs text-tertiary leading-tight mt-0.5">
                            {agenda.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {postMatchResult &&
                  postMatchResult.newAchievements.length > 0 &&
                  (() => {
                    const defs = postMatchResult.newAchievements
                      .map((id) => ACHIEVEMENT_MAP.get(id))
                      .filter((d): d is AchievementDef => !!d);
                    return (
                      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-900/10 p-[1.5vh]">
                        <div className="flex items-center gap-2 mb-2">
                          <Medal className="w-[2vh] h-[2vh] text-yellow-400 shrink-0" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-yellow-400">
                            Achievements Unlocked
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {defs.map((def) => (
                            <div
                              key={def.id}
                              className={cn(
                                'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[10px]',
                                TIER_COLOURS[def.tier]
                              )}
                            >
                              <span className="font-bold tracking-wide uppercase">{def.name}</span>
                              <span className="font-mono opacity-60">+{def.xpReward} XP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Right Column: Identities Reveal */}
              <div className="lg:w-1/2 lg:basis-1/2 flex flex-col min-h-0 bg-black/5 lg:bg-transparent shrink-0">
                <div className="flex-1 lg:overflow-y-auto custom-scrollbar p-[3vh] space-y-[2.5vh]">
                  <div className="text-responsive-xs uppercase tracking-[0.2em] text-muted font-mono border-b border-subtle/30 pb-2 flex justify-between items-center">
                    <span>Identity Revelations</span>
                    <OverseerIcon className="w-3 h-3 opacity-30" />
                  </div>

                  <div className="space-y-[1.5vh]">
                    {gameState.players.map((p) => {
                      const specInfo = gameState.spectatorRoles?.[p.id];
                      const titleRole = specInfo?.titleRole || p.titleRole;
                      const agendaName = specInfo?.agendaName;

                      return (
                        <div
                          key={p.id}
                          className="group p-2 rounded-xl transition-colors hover:bg-white/5 border border-transparent hover:border-subtle/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-glass/40 flex items-center justify-center text-[12px] text-muted font-mono overflow-hidden border border-default shadow-sm shrink-0">
                                {p.avatarUrl ? (
                                  <img
                                    src={getProxiedUrl(p.avatarUrl)}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  p.name.charAt(0)
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span
                                  className={cn(
                                    'text-sm font-medium transition-colors',
                                    p.id === myId
                                      ? 'text-primary font-bold'
                                      : 'text-secondary group-hover:text-primary'
                                  )}
                                >
                                  {p.name.replace(' (AI)', '')}
                                  {p.id === myId && (
                                    <span className="ml-1.5 text-[9px] text-yellow-500 uppercase tracking-tighter">
                                      You
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-[2px] shrink-0 border transition-all shadow-sm',
                                p.role === 'Civil'
                                  ? 'bg-blue-900/10 border-blue-500/20 text-blue-400'
                                  : p.role === 'State'
                                    ? 'bg-red-900/10 border-red-500/20 text-red-500'
                                    : 'bg-red-900/40 border-red-500 text-red-100 font-bold'
                              )}
                            >
                              {p.role === 'Civil'
                                ? 'Civil'
                                : p.role === 'State'
                                  ? 'State'
                                  : 'The Overseer'}
                            </div>
                          </div>

                          {/* Reveal extra info: Agenda & Title Role */}
                          {(agendaName || titleRole) && (
                            <div className="ml-11 mt-2 space-y-1.5 pt-2 border-t border-subtle/10">
                              {agendaName && (
                                <div className="flex items-center gap-1.5">
                                  <Target className="w-2.5 h-2.5 text-muted" />
                                  <span className="text-[10px] font-mono text-tertiary uppercase tracking-wider truncate">
                                    Agenda: <span className="text-secondary">{agendaName}</span>
                                  </span>
                                </div>
                              )}
                              {titleRole && (
                                <div className="flex items-center gap-1.5">
                                  <Shield className="w-2.5 h-2.5 text-red-500/70" />
                                  <span className="text-[10px] font-mono text-red-500/80 uppercase tracking-widest font-bold">
                                    {titleRole}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned action buttons */}
            <div className="p-[3vh] pt-0 shrink-0 space-y-3">
              <button
                onMouseEnter={() => playSound('hover')}
                onClick={onOpenLog}
                className="w-full py-[1.2vh] bg-card text-tertiary border border-default rounded-xl hover:bg-hover hover:text-primary transition-all font-mono text-responsive-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Scroll className="w-[2vh] h-[2vh]" />
                View Assembly Log
              </button>

              <div className="flex gap-3">
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={onPlayAgain}
                  className="flex-1 py-[1.5vh] btn-primary rounded-xl hover:bg-subtle transition-all font-thematic text-responsive-sm uppercase tracking-widest"
                >
                  Play Again
                </button>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={onLeave}
                  className="flex-1 py-[1.5vh] bg-card text-primary rounded-xl hover:bg-subtle transition-all font-thematic text-responsive-sm uppercase tracking-widest border border-default"
                >
                  Lobby
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


