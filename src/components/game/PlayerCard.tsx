import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Eye, Check, ShieldOff, WifiOff, AlertCircle, Skull } from 'lucide-react';
import { socket } from '../../socket';
import { GameState, Player } from '../../../shared/types';
import { getFrameStyles, getVoteStyles } from '../../utils/cosmetics';
import { cn, getProxiedUrl } from '../../utils/utils';
import { ClanEmblem } from '../clans/ClanEmblem';

const VideoPlayer = React.memo(
  ({
    stream,
    isMe,
    isVideoActive,
  }: {
    stream: MediaStream;
    isMe: boolean;
    isVideoActive: boolean;
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    React.useEffect(() => {
      if (!videoRef.current) return;
      // Always assign srcObject when we have a stream — never clear it based on
      // isVideoActive, because that would freeze/blank the element and it won't
      // recover when isVideoActive goes true again without a new stream reference.
      // Visibility is handled purely by the opacity CSS class below.
      videoRef.current.srcObject = stream;
    }, [stream]);

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMe}
        className={cn(
          'absolute inset-0 w-full h-full object-cover rounded-xl transition-opacity duration-300',
          !isVideoActive && 'opacity-0 pointer-events-none'
        )}
      />
    );
  }
);

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Civil: { label: 'C', color: 'text-blue-300', bg: 'bg-blue-900/80' },
  State: { label: 'S', color: 'text-red-300', bg: 'bg-red-900/80' },
  Overseer: { label: 'O', color: 'text-red-200', bg: 'bg-red-800/90' },
};

export interface PlayerCardProps {
  p: Player;
  index: number;
  gameState: GameState;
  isMe: boolean;
  isPresidentialCandidate: boolean;
  isPresident: boolean;
  isManyPlayers: boolean;
  isSpectator: boolean;
  isHost: boolean;
  stream: MediaStream | null;
  isVideoActive: boolean;
  speakingPlayers: Record<string, boolean>;
  reaction?: string;
  playSound: (key: string) => void;
  setSelectedPlayerId: (id: string | null) => void;
  me: Player | undefined;
}

export const PlayerCard = React.memo(
  ({
    p,
    index,
    gameState,
    isMe,
    isPresidentialCandidate,
    isPresident,
    isManyPlayers,
    isSpectator,
    isHost,
    stream,
    isVideoActive,
    speakingPlayers,
    reaction,
    playSound,
    setSelectedPlayerId,
    me,
  }: PlayerCardProps) => {
    const effectiveVote = p.vote || gameState.previousVotes?.[p.id];
    // Show flip when voting is complete for a player, or when revealing
    const showVoteBack = !!((gameState.openSession && p.vote) || (gameState.phase === 'Voting_Reveal' && effectiveVote) || (gameState.phase === 'Voting' && p.vote));
    const spectatorRole = isSpectator ? gameState.spectatorRoles?.[p.id] : undefined;
    const roleInfo = spectatorRole ? ROLE_LABELS[spectatorRole.role] : null;

    // Long-press / click-hold to open profile — hooks safely at component level
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);

    const handlePressStart = () => {
      if (isMe) return; // can't long-press your own card
      didLongPress.current = false;
      pressTimerRef.current = setTimeout(() => {
        didLongPress.current = true;
        if (p.userId) {
          playSound('click');
          setSelectedPlayerId(p.userId);
        }
      }, 500);
    };

    const handlePressEnd = () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };

    const hasVideo = stream?.getVideoTracks().some((t) => t.enabled) ?? false;
    // Use server-side state (p.isCamOn) as source of truth for visibility
    // If it's me, allow local toggle to also hide it for preview
    const showVideo = isMe ? isVideoActive && !!p.isCamOn && hasVideo : !!p.isCamOn && hasVideo;

    return (
      <motion.div
        role="button"
        aria-label={`Player ${p.name.replace(' (AI)', '')}${isMe ? ' (You)' : ''}`}
        tabIndex={0}
        animate={{ scale: speakingPlayers[p.id] ? 1.05 : 1 }}
        transition={{ duration: 0.2 }}
        onMouseEnter={() => playSound('hover')}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={cn(
          'relative p-[0.5vh] sm:p-[1vh] rounded-xl border transition-all duration-300 flex flex-col items-center justify-center min-h-0 cursor-pointer overflow-hidden group',
          p.isAlive
            ? 'bg-surface-card backdrop-blur-sm border-subtle'
            : 'bg-[radial-gradient(circle_at_center,_rgba(127,29,29,0.4)_0%,_rgba(0,0,0,0.8)_100%)] border-red-900/60 opacity-80 grayscale-[0.5] shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]',
          p.isPresidentialCandidate && gameState.phase !== 'Voting_Reveal' && 'border-yellow-500/80 ring-2 ring-yellow-500/40 animate-pulse bg-yellow-900/10 z-20',
          p.isChancellorCandidate && gameState.phase !== 'Voting_Reveal' && 'border-blue-500/80 ring-2 ring-blue-500/40 opacity-90 z-20',
          p.isPresident && 'bg-yellow-900/30 border-yellow-400 shadow-[0_0_25px_-5px_rgba(234,179,8,0.5)] border-2 ring-1 ring-yellow-500/30 z-30',
          p.isChancellor && 'bg-blue-900/30 border-blue-400 shadow-[0_0_25px_-5px_rgba(59,130,246,0.5)] border-2 ring-1 ring-blue-500/30 z-30'
        )}
      >
        {/* Dead state overlay marker */}
        {!p.isAlive && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-40 select-none">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-0.5 bg-red-700 rotate-[15deg] shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-0.5 bg-red-700 rotate-[-15deg] shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
          </div>
        )}
        {/* Reaction Overlay */}
        <AnimatePresence>
          {reaction && (
            <motion.div
              initial={{ scale: 0, scaleY: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, scaleY: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="absolute top-2 right-2 z-50 pointer-events-none drop-shadow-lg"
            >
              <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-2 py-1 flex items-center justify-center min-w-[2.5rem]">
                <span className="text-xl leading-none">{reaction}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Spectator role badges */}
        {isSpectator && roleInfo && (
          <div className="absolute top-0.5 right-0.5 z-20 flex flex-col gap-0.5 items-end pointer-events-none">
            <div
              className={cn(
                'px-1 py-0.5 rounded text-[8px] font-bold leading-none border border-white/20',
                roleInfo.bg,
                roleInfo.color
              )}
            >
              {roleInfo.label}
            </div>
            {spectatorRole?.titleRole && (
              <div className="hidden sm:block px-1 py-0.5 rounded text-[7px] font-mono leading-none bg-yellow-900/80 text-yellow-300 border border-yellow-700/40 max-w-[3.5rem] truncate">
                {spectatorRole.titleRole.slice(0, 5)}
              </div>
            )}
            {spectatorRole?.agendaName && (
              <div className="hidden sm:block px-1 py-0.5 rounded text-[7px] font-mono leading-none bg-emerald-900/80 text-emerald-300 border border-emerald-700/40 max-w-[3.5rem] truncate">
                {spectatorRole.agendaName.split(' ')[0]}
              </div>
            )}
          </div>
        )}

        {/* Not-Overseer marker */}
        {p.isProvenNotOverseer && (
          <div className="absolute top-0.5 left-0.5 z-20 pointer-events-none" title="Proven Not Overseer">
            <div className="p-0.5 rounded border border-white/20 bg-emerald-900/80 text-emerald-300">
              <ShieldOff className="w-2.5 h-2.5" />
            </div>
          </div>
        )}

        {/* Herald Claim Badge */}
        {gameState.heraldLog?.some(
          (entry) => entry.targetId === p.id && entry.response === 'Confirmed'
        ) && (
          <div className="absolute top-0.5 left-6 z-20 pointer-events-none group/herald" title="Herald Proclamation (Unverified)">
            <div className="px-1 py-0.5 rounded text-[8px] font-bold leading-none border border-blue-500/30 bg-blue-900/90 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)] animate-pulse">
              C?
            </div>
          </div>
        )}

        {/* Quorum Revote Badge */}
        {gameState.isRevote && p.isPresident && (
          <div className="absolute -right-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div className="px-1 py-0.5 rounded-l text-[8px] font-mono leading-none bg-orange-900/90 text-orange-400 border border-orange-700/40 shadow-[0_0_10px_rgba(251,146,60,0.2)]">
              REVOTE
            </div>
          </div>
        )}

        {/* Declaration Indicators */}
        {(() => {
          // Show declarations once both have declared (or Chancellor alone if President blocked)
          const chanDeclared = gameState.declarations.some((d) => d.type === 'Chancellor');
          const presDeclared = gameState.declarations.some((d) => d.type === 'President');
          const declarationsComplete = (presDeclared && chanDeclared) || (gameState.presidentDeclarationBlocked && chanDeclared);
          
          if (!declarationsComplete) return null;

          const playerDecls = gameState.declarations.filter((d) => d.playerId === p.id);
          const presDecl = playerDecls.find((d) => d.type === 'President');
          const chanDecl = playerDecls.find((d) => d.type === 'Chancellor');
          
          if (!presDecl && !chanDecl) return null;

          const isBlocked = presDecl?.isBlocked;

          return (
            <div className="absolute bottom-1.5 left-1.5 z-20 flex flex-col gap-1 pointer-events-none scale-[0.85] origin-bottom-left">
              {presDecl && (
                <div className="flex flex-col gap-1">
                  {/* Drawn Row */}
                  <div className={cn("flex items-center gap-1 group/decl", isBlocked && "opacity-40")}>
                    <span className={cn("text-[7px] font-mono font-bold w-2 shrink-0", isBlocked ? "text-muted" : "text-yellow-500")}>
                      D
                    </span>
                    <div className="flex gap-0.5">
                      {isBlocked ? (
                        [...Array(3)].map((_, i) => (
                          <div
                            key={`dcg-${i}`}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-white/10 border border-white/20"
                          />
                        ))
                      ) : (
                        [...Array(presDecl?.drewCiv ?? 0)].map((_, i) => (
                          <div
                            key={`dc-${i}`}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-blue-500/40 border border-blue-500/60 shadow-[0_0_4px_rgba(59,130,246,0.3)]"
                          />
                        ))
                      )}
                      {!isBlocked && [...Array(presDecl?.drewSta ?? 0)].map((_, i) => (
                        <div
                          key={`ds-${i}`}
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-red-500/40 border border-red-500/60 shadow-[0_0_4px_rgba(239,68,68,0.3)]"
                        />
                      ))}
                    </div>
                  </div>
                  {/* Passed Row */}
                  <div className={cn("flex items-center gap-1 group/decl", isBlocked && "opacity-40")}>
                    <span className={cn("text-[7px] font-mono font-bold w-2 shrink-0", isBlocked ? "text-muted" : "text-yellow-500")}>
                      P
                    </span>
                    <div className="flex gap-0.5">
                      {isBlocked ? (
                        [...Array(2)].map((_, i) => (
                          <div
                            key={`pcg-${i}`}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-white/10 border border-white/20"
                          />
                        ))
                      ) : (
                        [...Array(presDecl?.civ ?? 0)].map((_, i) => (
                          <div
                            key={`pc-${i}`}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-blue-500/40 border border-blue-500/60 shadow-[0_0_4px_rgba(59,130,246,0.3)]"
                          />
                        ))
                      )}
                      {!isBlocked && [...Array(presDecl?.sta ?? 0)].map((_, i) => (
                        <div
                          key={`ps-${i}`}
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-red-500/40 border border-red-500/60 shadow-[0_0_4px_rgba(239,68,68,0.3)]"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {chanDecl && (
                <div className="flex items-center gap-1 group/decl">
                  <span className="text-[7px] font-mono font-bold text-blue-400 w-2 shrink-0">
                    R
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(chanDecl.civ ?? 0)].map((_, i) => (
                      <div
                        key={`cc-${i}`}
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-blue-500/40 border border-blue-500/60 shadow-[0_0_4px_rgba(59,130,246,0.3)]"
                      />
                    ))}
                    {[...Array(chanDecl.sta ?? 0)].map((_, i) => (
                      <div
                        key={`cs-${i}`}
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[1px] bg-red-500/40 border border-red-500/60 shadow-[0_0_4px_rgba(239,68,68,0.3)]"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {speakingPlayers[p.id] && (
          <div className="absolute inset-0 pointer-events-none rounded-xl shadow-[inset_0_0_20px_rgba(16,185,129,0.4)] border border-emerald-500/50 z-20" />
        )}

        <motion.div
          animate={{
            rotateY: showVoteBack ? 180 : 0,
            scale: showVoteBack ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 0.6,
            type: 'spring',
            stiffness: 260,
            damping: 20,
            delay: (gameState.phase === 'Voting_Reveal' && !gameState.openSession) ? index * 0.15 : 0,
          }}
          className="w-full h-full relative preserve-3d"
        >
          {/* Front */}
          <div className="absolute inset-0 flex flex-col items-center justify-center backface-hidden">
            {stream && <VideoPlayer stream={stream} isMe={isMe} isVideoActive={showVideo} />}
            {gameState.chatBlackout && showVideo && (
              <div className="absolute inset-0 z-20 bg-blackout-static rounded-xl overflow-hidden pointer-events-none" />
            )}

            <div
              className={cn(
                'flex min-h-0 overflow-hidden z-10 w-full h-full',
                showVideo
                  ? 'flex-row justify-between items-end p-2'
                  : 'flex-col items-center justify-center text-center'
              )}
            >
              <div className={cn('relative shrink-0 p-1', showVideo && 'hidden')}>
                <div
                  className={cn(
                    'bg-card flex items-center justify-center relative',
                    !p.activeFrame && 'border border-default',
                    isManyPlayers
                      ? 'w-6 h-6 sm:w-12 sm:h-12 rounded-lg'
                      : 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl'
                  )}
                >
                  {p.avatarUrl ? (
                    <img
                      src={getProxiedUrl(p.avatarUrl)}
                      alt={p.name}
                      className={cn(
                        'w-full h-full object-cover',
                        isManyPlayers ? 'rounded-lg' : 'rounded-xl'
                      )}
                    />
                  ) : (
                    <Users
                      className={cn(
                        'text-muted',
                        isManyPlayers ? 'w-3 h-3 sm:w-6 sm:h-6' : 'w-5 h-5 sm:w-6 sm:h-6'
                      )}
                    />
                  )}
                  {p.activeFrame && (
                    <div
                      className={cn(
                        'absolute inset-0 pointer-events-none',
                        isManyPlayers ? 'rounded-lg' : 'rounded-xl',
                        getFrameStyles(p.activeFrame)
                      )}
                    />
                  )}
                  {!p.isAlive && (
                    <div
                      className={cn(
                        'absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-[1px]',
                        isManyPlayers ? 'rounded-lg' : 'rounded-xl'
                      )}
                    >
                      <Skull
                        className={cn(
                          'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse-slow',
                          isManyPlayers ? 'w-4 h-4 sm:w-8 sm:h-8' : 'w-6 h-6 sm:w-8 sm:h-8'
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Mobile-only avatar corner badges — replaces text badges below name */}
                <div className="sm:hidden absolute -top-1 -right-1 flex flex-col gap-0.5 z-10 items-end">
                  {(p.isPresident || p.isPresidentialCandidate) && (
                    <div className="w-4 h-4 bg-yellow-500 rounded-sm border border-black/40 flex items-center justify-center shadow-md">
                      <span className="text-[8px] font-bold text-black leading-none">P</span>
                    </div>
                  )}
                  {(p.isChancellor || p.isChancellorCandidate) && (
                    <div className="w-4 h-4 bg-blue-500 rounded-sm border border-black/40 flex items-center justify-center shadow-md">
                      <span className="text-[8px] font-bold text-white leading-none">C</span>
                    </div>
                  )}
                  {gameState.detainedPlayerId === p.id && (
                    <div className="w-4 h-4 bg-purple-600 rounded-sm border border-black/40 flex items-center justify-center shadow-md">
                      <span className="text-[8px] font-bold text-white leading-none">D</span>
                    </div>
                  )}
                  {gameState.censuredPlayerId === p.id && (
                    <div className="w-4 h-4 bg-red-600 rounded-sm border border-black/40 flex items-center justify-center shadow-md animate-pulse">
                      <span className="text-[8px] font-bold text-white leading-none">X</span>
                    </div>
                  )}
                  {gameState.ghostVoterId === p.id && (
                    <div className="w-4 h-4 bg-slate-700 rounded-sm border border-white/20 flex items-center justify-center shadow-md">
                      <span className="text-[8px] font-bold text-slate-300 leading-none">G</span>
                    </div>
                  )}
                  {/* Herald Results */}
                  {gameState.heraldLog?.filter((log) => log.targetId === p.id).map((log, i) => (
                    <div
                      key={`herald-mob-${i}`}
                      className={cn(
                        'w-4 h-4 rounded-sm border border-black/40 flex items-center justify-center shadow-md',
                        log.response === 'Confirmed' ? 'bg-emerald-600' : 'bg-red-600'
                      )}
                      title={`${log.response} by Herald`}
                    >
                      <span className="text-[8px] font-bold text-white leading-none">H</span>
                    </div>
                  ))}
                </div>

                {p.activeFrame && (
                  <div
                    className={cn(
                      'absolute -inset-1 pointer-events-none',
                      isManyPlayers ? 'rounded-lg' : 'rounded-xl',
                      p.activeFrame === 'frame-red' && 'border-red-500',
                      p.activeFrame === 'frame-gold' && 'border-yellow-500',
                      p.activeFrame === 'frame-blue' && 'border-blue-500',
                      p.activeFrame === 'frame-rainbow' && 'border-purple-500',
                      p.activeFrame === 'frame-neon' && 'border-emerald-500',
                      p.activeFrame === 'frame-shadow' && 'border-gray-500',
                      p.activeFrame === 'frame-common-basic' && 'border-gray-400',
                      p.activeFrame === 'frame-uncommon-bronze' && 'border-amber-700',
                      p.activeFrame === 'frame-rare-silver' && 'border-gray-300',
                      p.activeFrame === 'frame-epic-violet' && 'border-purple-600',
                      p.activeFrame === 'frame-legendary-cosmic' && 'border-pink-500'
                    )}
                  />
                )}
              </div>

              <div className={cn(
                "flex min-w-0 overflow-hidden",
                showVideo ? "flex-row items-center gap-1" : "flex-col items-center"
              )}>
                <div
                  className={cn(
                    'font-thematic tracking-wide font-semibold truncate px-1 leading-tight shrink-0 flex items-center gap-1',
                    stream && isVideoActive
                      ? 'text-[7px] sm:text-[9px] bg-backdrop-sm rounded px-1'
                      : 'text-[9px] sm:text-[11px]',
                    p.isAlive ? 'text-primary/90' : 'text-ghost'
                  )}
                >
                  {p.name.replace(' (AI)', '')} {isMe && '(You)'}
                  {p.isLagging && !p.isDisconnected && (
                    <AlertCircle className="w-2 h-2 sm:w-3 sm:h-3 text-yellow-500 animate-pulse shrink-0" />
                  )}
                </div>

                {/* Clan tag — shown right of name when video active, under when not */}
                {p.clanTag && (
                  <div className={cn(
                    "flex items-center gap-1 bg-card/40 rounded-full px-1.5 py-0.5 border border-white/5 shrink-0",
                    showVideo ? "scale-[0.8] origin-left" : "mt-0.5"
                  )}>
                    {p.clanEmblem && <ClanEmblem emblem={p.clanEmblem} size="xs" />}
                    <div className="font-light text-[7px] sm:text-[8px] text-ghost/70 truncate leading-none">
                      {p.clanTag}
                    </div>
                  </div>
                )}
              </div>
              <div
                className={cn(
                  'flex flex-wrap gap-0.5 sm:gap-1 shrink-0',
                  stream && isVideoActive ? 'justify-end' : 'justify-center hidden sm:flex'
                )}
              >
                {gameState.detainedPlayerId === p.id && (
                  <span className="px-1 sm:px-2 py-0.5 bg-purple-900/40 text-purple-500 font-mono uppercase rounded border border-purple-900/50 text-[7px] sm:text-[9px]">
                    Detained
                  </span>
                )}
                {(p.isPresident || p.isPresidentialCandidate) && (
                  <span className="px-1 sm:px-2 py-0.5 bg-yellow-900/40 text-yellow-500 font-mono uppercase rounded border border-yellow-900/50 text-[7px] sm:text-[9px]">
                    {p.isPresident ? 'President' : 'Candidate'}
                  </span>
                )}
                {(p.isChancellor || p.isChancellorCandidate) && (
                  <span className="px-1 sm:px-2 py-0.5 bg-blue-900/40 text-blue-500 font-mono uppercase rounded border border-blue-900/50 text-[7px] sm:text-[9px]">
                    {p.isChancellor ? 'Chancellor' : 'Nominated'}
                  </span>
                )}
                {!p.isAlive && (
                  <span className="px-1 sm:px-2 py-0.5 bg-red-900/20 text-red-500 font-mono uppercase rounded border border-red-900/50 text-[7px] sm:text-[9px]">
                    Eliminated
                  </span>
                )}
                {gameState.censuredPlayerId === p.id && (
                  <span className="px-1 sm:px-2 py-0.5 bg-red-900/40 text-red-400 font-mono uppercase rounded border border-red-500/50 text-[7px] sm:text-[9px] animate-pulse">
                    Censured
                  </span>
                )}
                {/* Herald Results Desktop */}
                {gameState.heraldLog?.filter((log) => log.targetId === p.id).map((log, i) => (
                  <span
                    key={`herald-desk-${i}`}
                    className={cn(
                      "px-1 sm:px-2 py-0.5 font-mono uppercase rounded border text-[7px] sm:text-[9px]",
                      log.response === 'Confirmed' 
                        ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50" 
                        : "bg-red-900/40 text-red-400 border-red-500/50"
                    )}
                  >
                    Herald: {log.response}
                  </span>
                ))}
              </div>

            </div>
          </div>

          {/* Back: Vote reveal */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center backface-hidden rotate-y-180 rounded-xl border-2 overflow-hidden',
              gameState.phase === 'Voting' && !gameState.openSession
                ? 'bg-emerald-600/90 border-emerald-400'
                : getVoteStyles(p.activeVotingStyle, effectiveVote)
            )}
          >
            {gameState.phase === 'Voting' && !gameState.openSession ? (
              <Check className="w-10 h-10 sm:w-16 sm:h-16 text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
            ) : (
              <>
                {p.activeVotingStyle === 'vote-pass-0' && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
                    <div className="absolute inset-0 animate-purple-rain bg-purple-500/50" />
                  </div>
                )}
                <div className="text-2xl font-thematic uppercase tracking-widest leading-none">
                  {effectiveVote}
                </div>
                <div className="text-[8px] font-mono uppercase mt-1">
                  ({effectiveVote === 'Aye' ? 'YES' : 'NO'})
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Nominate overlay */}
        {gameState.phase === 'Nominate_Chancellor' &&
          isPresidentialCandidate &&
          !isMe &&
          p.isAlive &&
          (() => {
            const aliveCount = gameState.players.filter((pl) => pl.isAlive).length;
            const isEligible =
              !p.wasChancellor &&
              !(aliveCount > 5 && p.wasPresident) &&
              p.id !== gameState.detainedPlayerId &&
              p.id !== gameState.rejectedChancellorId;
            if (!isEligible) return null;
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playSound('click');
                  socket.emit('nominateChancellor', p.id);
                }}
                aria-label={`Nominate ${p.name.replace(' (AI)', '')} for Chancellor`}
                className="absolute inset-0 bg-blue-900/80 rounded-xl flex items-center justify-center font-thematic tracking-wide text-white text-[12px] uppercase"
              >
                Nominate
              </button>
            );
          })()}

        {/* Title Role Targets (Assassin & Interdictor) */}
        {gameState.titlePrompt &&
          me &&
          gameState.titlePrompt.playerId === me.id &&
          !gameState.heraldPendingResponse &&
          !isMe &&
          p.isAlive &&
          (() => {
            if (gameState.titlePrompt.role === 'Assassin') {
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click');
                    socket.emit('useTitleAbility', { use: true, role: 'Assassin', targetId: p.id });
                  }}
                  aria-label={`Execute ${p.name.replace(' (AI)', '')}`}
                  className="absolute inset-0 z-30 bg-red-900/80 rounded-xl flex items-center justify-center font-serif italic text-white text-[9px] text-center px-1"
                >
                  Execute
                </button>
              );
            } else if (gameState.titlePrompt.role === 'Interdictor') {
              const currentPresidentId = gameState.players[gameState.presidentIdx]?.id;
              if (p.id !== currentPresidentId) {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click');
                      socket.emit('useTitleAbility', {
                        use: true,
                        role: 'Interdictor',
                        targetId: p.id,
                      });
                    }}
                    aria-label={`Detain ${p.name.replace(' (AI)', '')}`}
                    className="absolute inset-0 z-30 bg-purple-900/80 rounded-xl flex items-center justify-center font-serif italic text-white text-[9px] text-center px-1"
                  >
                    Detain
                  </button>
                );
              }
            } else if (gameState.titlePrompt.role === 'Herald') {
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click');
                    socket.emit('useTitleAbility', {
                      use: true,
                      role: 'Herald',
                      targetId: p.id,
                      claim: 'Civil',
                    });
                  }}
                  aria-label={`Proclaim ${p.name.replace(' (AI)', '')} as Civil`}
                  className="absolute inset-0 z-30 bg-emerald-900/80 rounded-xl flex items-center justify-center font-serif italic text-white text-[9px] text-center px-1"
                >
                  Proclaim Civil
                </button>
              );
            }
            return null;
          })()}

        {/* Executive action overlay */}
        {gameState.phase === 'Executive_Action' &&
          isPresident &&
          !isMe &&
          p.isAlive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSound('click');
                socket.emit('performExecutiveAction', p.id);
              }}
              aria-label={`${gameState.currentExecutiveAction} ${p.name.replace(' (AI)', '')}`}
              className="absolute inset-0 bg-red-900/80 rounded-xl flex items-center justify-center font-serif italic text-white text-[9px] text-center px-1"
            >
              {gameState.currentExecutiveAction}
            </button>
          )}

        {/* Censure overlay */}
        {gameState.phase === 'Censure_Action' &&
          me?.isAlive &&
          p.isAlive &&
          p.id !== gameState.players[gameState.presidentIdx]?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSound('click');
                socket.emit('censureVote', { targetId: p.id });
              }}
              aria-label={`Vote to censure ${p.name.replace(' (AI)', '')}`}
              className={cn(
                'absolute inset-0 z-30 rounded-xl flex flex-col items-center justify-center font-serif italic text-white text-center px-2 transition-all duration-300',
                me.censureVoteId === p.id
                  ? 'bg-red-600/90 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]'
                  : 'bg-red-900/60 hover:bg-red-900/80 backdrop-blur-[1px]'
              )}
            >
              <span className="text-[10px] sm:text-[12px] uppercase tracking-wider not-italic font-bold mb-1">
                {me.censureVoteId === p.id ? 'Selected' : 'Censure'}
              </span>
              <span className="text-[8px] sm:text-[9px] opacity-80 leading-tight">
                {me.censureVoteId === p.id ? 'Tap another to change' : 'Exclude from nominations'}
              </span>
            </button>
          )}

        {/* Host kick overlay — lobby only */}
        {isHost && gameState.phase === 'Lobby' && !isMe && !p.isAI && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playSound('click');
              socket.emit('kickPlayer', p.id);
            }}
            aria-label={`Kick ${p.name.replace(' (AI)', '')}`}
            className="absolute top-1 left-1 z-30 p-1 rounded-lg bg-red-900/80 border border-red-700/50 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900"
          >
            <ShieldOff className="w-[1.5vh] h-[1.5vh]" />
          </button>
        )}
        {/* Detained Chains Overlay */}
        {gameState.detainedPlayerId === p.id && (
          <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden shadow-[inset_0_0_40px_rgba(147,51,234,0.4)] border-2 border-purple-500/50">
            <div className="absolute -inset-[100%] rotate-45 bg-detained-chains transition-opacity duration-300 opacity-70" />
          </div>
        )}

        {/* Connection Status Indicator - Only show disconnected as full overlay */}
        {p.isDisconnected && (
          <div className="absolute inset-0 z-[60] pointer-events-none rounded-xl flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-1">
              <WifiOff className="w-8 h-8 text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest bg-black/80 px-2 py-0.5 rounded border border-red-500/30">
                Reconnecting
              </span>
            </div>
          </div>
        )}
      </motion.div>
    );
  }
);


