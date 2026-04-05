import React from 'react';
import {
  Scroll,
  Scale,
  Eye,
  Mic,
  Video,
  VideoOff,
  MicOff,
  Lock,
  Unlock,
  Play,
  ShieldAlert,
  Smile,
  AlertCircle,
  EyeOff,
  RotateCw,
  Zap,
  Shield,
  UserMinus,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from '../Tooltip';
import { socket } from '../../socket';
import { GameState, Player, User } from '../../../shared/types';
import { getPolicyStyles, getVoteStyles } from '../../utils/cosmetics';
import { cn } from '../../utils/utils';

interface ActionBarProps {
  gameState: GameState;
  me: Player | undefined;
  user: User | null;
  showDebug: boolean;
  onOpenLog: () => void;
  onPlayAgain: () => void;
  onLeaveRoom: () => void;
  playSound: (key: string) => void;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  isVideoActive: boolean;
  setIsVideoActive: (active: boolean) => void;
  isDebriefing: boolean;
}

export const ActionBar = ({
  gameState,
  me,
  user,
  showDebug,
  onOpenLog,
  onPlayAgain,
  onLeaveRoom,
  playSound,
  isVoiceActive,
  setIsVoiceActive,
  isVideoActive,
  setIsVideoActive,
  isDebriefing,
}: ActionBarProps) => {
  const [showReactions, setShowReactions] = React.useState(false);
  const [showCipherInput, setShowCipherInput] = React.useState(false);
  const [cipherMessage, setCipherMessage] = React.useState('');
  const isPresident = me?.isPresident;
  const isChancellor = me?.isChancellor;

  const filteredLog = showDebug
    ? gameState.log
    : gameState.log.filter((entry) => !entry.includes('DEBUG:'));
  const lastEntry = filteredLog[filteredLog.length - 1];

  const phaseLabel = () => {
    switch (gameState.phase) {
      case 'Lobby':
        return `Waiting for players (${gameState.players.length}/${gameState.maxPlayers})...`;
      case 'Nominate_Chancellor':
        return `${gameState.players[gameState.presidentIdx]?.name} is nominating a Chancellor.`;
      case 'Nomination_Review':
        if (gameState.titlePrompt?.role === 'Interdictor')
          return 'Interdictor is choosing a target.';
        if (gameState.titlePrompt?.role === 'Broker') return 'Broker is reviewing the nomination.';
        return 'The Assembly is reviewing the nomination.';
      case 'Voting':
      case 'Voting_Reveal':
        return 'The Assembly is voting.';
      case 'Legislative_President':
        if (gameState.titlePrompt?.role === 'Strategist')
          return 'Strategist is looking at the deck.';
        return 'President is reviewing directives.';
      case 'Legislative_Chancellor':
        if (gameState.lastEnactedPolicy) return 'Players are declaring directives.';
        return 'Chancellor is enacting a directive.';
      case 'Auditor_Action':
        return 'Auditor is inspecting the discard pile.';
      case 'Herald_Action':
        return 'Herald is making a public proclamation.';
      case 'Quorum_Action':
        return 'The Quorum is deciding on an emergency re-vote.';
      case 'Assassin_Action':
        return 'Assassin is choosing a target.';
      case 'Handler_Action':
        return 'Handler is using their power.';
      case 'Censure_Action':
        return 'The Assembly is debating a Censure Motion.';
      case 'Snap_Election':
        return 'Volunteers are stepping forward for the Snap Election.';
      case 'Event_Reveal':
        return 'Crisis Event Incoming...';
      case 'Executive_Action':
        switch (gameState.currentExecutiveAction) {
          case 'Investigate':
            return "President is investigating a player's loyalty.";
          case 'SpecialElection':
            return 'President is calling a Special Election.';
          case 'Execution':
            return 'President is executing a player.';
          case 'PolicyPeek':
            return 'President is reviewing the top three policies.';
          default:
            return 'President is deciding on an executive action.';
        }
      case 'GameOver':
        return `${gameState.winner === 'Civil' ? 'Civil' : 'State'} faction victorious!`;
      default:
        return 'The Assembly is in session.';
    }
  };

  const phaseHint = () => {
    const isPresident = me?.isPresidentialCandidate || me?.isPresident;
    const isChancellor = me?.isChancellorCandidate || me?.isChancellor;
    switch (gameState.phase) {
      case 'Nominate_Chancellor':
        return isPresident
          ? 'Tap a player on the board to nominate them as Chancellor.'
          : 'Watch the nomination — it reveals who the President trusts.';
      case 'Voting':
        return me?.id === gameState.detainedPlayerId
          ? 'You are detained and cannot vote this round.'
          : 'Vote AYE to support this government or NAY to block it.';
      case 'Legislative_President':
        return isPresident
          ? 'Discard one policy card. The other two go to the Chancellor.'
          : 'The President is choosing which policy to pass to the Chancellor.';
      case 'Legislative_Chancellor':
        if (gameState.lastEnactedPolicy) {
          return 'Declarations tell the table what was drawn and passed. They may be lies.';
        }
        return isChancellor
          ? 'Enact one policy. You may propose a Veto if 5+ State directives are enacted.'
          : 'The Chancellor is choosing which policy to enact.';
      case 'Executive_Action':
        if (isPresident) {
          switch (gameState.currentExecutiveAction) {
            case 'Investigate':
              return 'Select a player to investigate their party loyalty.';
            case 'SpecialElection':
              return 'Select a player to be the next President.';
            case 'Execution':
              return 'Select a player to execute.';
            case 'PolicyPeek':
              return 'Review the top 3 cards of the deck.';
            default:
              return 'You must use your executive power.';
          }
        }
        return 'The President must use their executive power.';
      case 'Lobby':
        return "Press Ready Up when you're ready to start. The game begins when all players are ready.";
      default:
        return '\u00A0';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
      className="shrink-0 bg-elevated border-t border-subtle flex flex-col"
    >
      {/* Phase status */}
      <div className="px-[2vw] py-[1.5vh] bg-white/5 border-b border-subtle flex justify-between items-center">
        <div className="min-w-0 flex-1 mr-2 flex flex-col justify-center">
          <div className="text-responsive-xs uppercase tracking-[0.2em] text-muted font-light mb-1">
            Current Phase
          </div>
          <div className="min-h-[1.5em] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={gameState.phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-responsive-sm font-serif italic text-primary"
              >
                {phaseLabel() || '\u00A0'}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Phase hints — always render the block to maintain 3-line height */}
          <div className="text-responsive-xs text-faint font-light mt-1 leading-tight truncate min-h-[1.25em]">
            {(user && (user.stats?.gamesPlayed ?? 0) < 5 && phaseHint()) || '\u00A0'}
          </div>
          {/* Cipher Parallel Action Button */}
          {gameState.phase === 'Legislative_President' &&
            me?.titleRole === 'Cipher' &&
            !me.cipherUsed &&
            !me.isPresident && (
              <button
                onClick={() => {
                  playSound('click');
                  setShowCipherInput(true);
                }}
                className="text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded ml-2 hover:bg-emerald-400/10 transition-colors"
                title="Send anonymous dispatch"
              >
                Cipher Active
              </button>
            )}
        </div>
        
        {/* Active Crisis Event Card (Integrated) */}
        {gameState.activeEventCard && (
          <Tooltip 
            position="top"
            align="end"
            content={
              <div className="max-w-[200px] flex flex-col gap-1 py-1">
                <div className="font-serif italic text-primary text-[12px] border-b border-white/10 pb-1 mb-1">
                  {gameState.activeEventCard.name}
                </div>
                <div className="text-[10px] leading-relaxed text-zinc-300">
                  {gameState.activeEventCard.description}
                </div>
              </div>
            }
          >
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 cursor-help"
            >
              <div className="shrink-0 text-primary">
                {(() => {
                  const id = gameState.activeEventCard.id;
                  switch (id) {
                    case 'state_of_emergency': return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
                    case 'blackout': return <EyeOff className="w-3.5 h-3.5 text-zinc-400" />;
                    case 'snap_election': return <RotateCw className="w-3.5 h-3.5 text-purple-400" />;
                    case 'iron_mandate': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
                    case 'open_session': return <Scale className="w-3.5 h-3.5 text-blue-400" />;
                    case 'censure_motion': return <UserMinus className="w-3.5 h-3.5 text-white" />;
                    case 'veiled_proceedings': return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
                    case 'dead_mans_gambit': return <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />;
                    case 'double_or_nothing': return <Zap className="w-3.5 h-3.5 text-orange-400" />;
                    default: return <AlertCircle className="w-3.5 h-3.5 text-primary" />;
                  }
                })()}
              </div>
              <div className="min-w-0 max-w-[80px] sm:max-w-[120px]">
                <div className="text-[8px] font-light uppercase tracking-[0.15em] text-faint leading-none mb-0.5">
                  Crisis Active
                </div>
                <div className="text-[11px] font-serif italic text-primary truncate leading-none">
                  {gameState.activeEventCard.name}
                </div>
              </div>
            </motion.div>
          </Tooltip>
        )}

        <div className="flex gap-2 items-center">
          <div className="relative">
            <Tooltip position="top" content="Quick Reactions">
              <button
                aria-label="Toggle Reactions"
                onMouseEnter={() => playSound('hover')}
                onClick={() => {
                  playSound('click');
                  setShowReactions(!showReactions);
                }}
                className={cn(
                  'p-[1vh] rounded-full transition-all',
                  showReactions ? 'bg-primary text-deep scale-110' : 'bg-card text-muted hover:text-primary'
                )}
              >
                <Smile className="w-[2vh] h-[2vh]" />
              </button>
            </Tooltip>

            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="absolute bottom-full mb-2 right-0 bg-elevated border border-subtle p-2 rounded-2xl flex gap-1 shadow-2xl z-[100]"
                >
                  {['👍', '👎', '😂', '🤔', '👀', '🤐', '🔥', '💀'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        playSound('click');
                        socket.emit('sendReaction', emoji);
                        setShowReactions(false);
                      }}
                      className="w-[4vh] h-[4vh] flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip position="top" content={isVoiceActive ? 'Mute Mic' : 'Unmute Mic'}>
            <button
              aria-label={isVoiceActive ? 'Mute Mic' : 'Unmute Mic'}
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                setIsVoiceActive(!isVoiceActive);
              }}
              className={cn(
                'p-[1vh] rounded-full transition-colors',
                isVoiceActive ? 'bg-red-900/40 text-red-500' : 'bg-card text-muted'
              )}
            >
              {isVoiceActive ? (
                <Mic className="w-[2vh] h-[2vh]" />
              ) : (
                <MicOff className="w-[2vh] h-[2vh]" />
              )}
            </button>
          </Tooltip>
          <Tooltip position="top" content={isVideoActive ? 'Stop Video' : 'Start Video'}>
            <button
              aria-label={isVideoActive ? 'Stop Video' : 'Start Video'}
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                setIsVideoActive(!isVideoActive);
              }}
              className={cn(
                'p-[1vh] rounded-full transition-colors',
                isVideoActive ? 'bg-red-900/40 text-red-500' : 'bg-card text-muted'
              )}
            >
              {isVideoActive ? (
                <Video className="w-[2vh] h-[2vh]" />
              ) : (
                <VideoOff className="w-[2vh] h-[2vh]" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Action area - fixed height to prevent layout shift */}
      <div className="px-[2vw] py-[1vh] sm:py-[1.5vh] h-[12vh] sm:h-[15vh] flex items-center justify-center relative">
        {/* Cipher Input Overlay (Parallel) */}
        {showCipherInput && (
          <div className="absolute inset-0 z-50 bg-base/95 backdrop-blur-xl flex items-center justify-center px-4 animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">
                  Encrypted Dispatch Channel
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder="Enter message (max 80 chars)..."
                  maxLength={80}
                  value={cipherMessage}
                  onChange={(e) => setCipherMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && cipherMessage.trim()) {
                      playSound('click');
                      socket.emit('useTitleAbility', {
                        use: true,
                        role: 'Cipher',
                        message: cipherMessage.trim(),
                      });
                      setShowCipherInput(false);
                      setCipherMessage('');
                    } else if (e.key === 'Escape') {
                      setShowCipherInput(false);
                    }
                  }}
                  className="flex-1 bg-card border border-emerald-500/30 p-2 rounded-xl font-mono text-sm focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-muted/40"
                />
                <button
                  onClick={() => {
                    if (cipherMessage.trim()) {
                      playSound('click');
                      socket.emit('useTitleAbility', {
                        use: true,
                        role: 'Cipher',
                        message: cipherMessage.trim(),
                      });
                      setShowCipherInput(false);
                      setCipherMessage('');
                    }
                  }}
                  disabled={!cipherMessage.trim()}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
                <button
                  onClick={() => setShowCipherInput(false)}
                  className="px-4 py-2 bg-subtle hover:bg-muted-bg text-primary rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
              <div className="text-[9px] text-faint font-mono text-right uppercase tracking-[0.2em]">
                {cipherMessage.length}/80 Characters
              </div>
            </div>
          </div>
        )}

        {/* Title Role Prompt */}
        {gameState.titlePrompt && gameState.titlePrompt.playerId === me?.id && !gameState.heraldPendingResponse && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            {[
              'Strategist',
              'Broker',
              'Handler',
              'Auditor',
              'Archivist',
              'Herald',
              'Quorum',
            ].includes(gameState.titlePrompt.role) ? (
              <>
                <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center">
                  {gameState.titlePrompt.role === 'Strategist' &&
                    'Use Strategist power to draw an extra policy?'}
                  {gameState.titlePrompt.role === 'Broker' &&
                    'Use Broker power to force a re-nomination?'}
                  {gameState.titlePrompt.role === 'Handler' &&
                    'Use Handler power to swap the next two players in the presidential order?'}
                  {gameState.titlePrompt.role === 'Auditor' &&
                    'Use Auditor power to peek at the discard pile?'}
                  {gameState.titlePrompt.role === 'Archivist' &&
                    'Use Archivist power to peek at the discard pile?'}
                  {gameState.titlePrompt.role === 'Herald' &&
                    'Use Herald power to proclaim a player as Civil?'}
                  {gameState.titlePrompt.role === 'Quorum' &&
                    'Use Quorum power to call for an emergency re-vote?'}
                </div>
                <div className="flex gap-[2vw] w-full max-w-[30vh]">
                  <button
                    onMouseEnter={() => playSound('hover')}
                    onClick={() => {
                      playSound('click');
                      socket.emit('useTitleAbility', {
                        use: true,
                        role: gameState.titlePrompt!.role as any,
                      });
                    }}
                    className="flex-1 py-[1vh] btn-primary rounded-xl font-bold hover:bg-subtle transition-all"
                  >
                    Yes
                  </button>
                  <button
                    onMouseEnter={() => playSound('hover')}
                    onClick={() => {
                      playSound('click');
                      socket.emit('useTitleAbility', { use: false });
                    }}
                    className="flex-1 py-[1vh] bg-subtle text-primary rounded-xl font-bold hover:bg-muted-bg transition-all"
                  >
                    No
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center">
                  {gameState.titlePrompt.role === 'Assassin' &&
                    'Select a player to execute on their card, or skip.'}
                  {gameState.titlePrompt.role === 'Interdictor' &&
                    'Select a player to detain on their card, or skip.'}
                </div>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('click');
                    socket.emit('useTitleAbility', { use: false });
                  }}
                  className="px-[4vw] py-[1vh] bg-subtle text-primary rounded-xl font-bold hover:bg-muted-bg transition-all"
                >
                  Skip Power
                </button>
              </>
            )}
          </div>
        )}

        {/* Herald Pending Response UI */}
        {gameState.phase === 'Herald_Action' &&
          gameState.heraldPendingResponse?.targetId === me?.id && (
            <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
              <div className="text-responsive-xs font-mono uppercase tracking-widest text-primary text-center">
                The Herald claims you are Civil. Do you confirm?
              </div>
              <div className="flex gap-[2vw] w-full max-w-[30vh]">
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('click');
                    socket.emit('heraldResponse', 'Confirmed');
                  }}
                  className="flex-1 py-[1vh] bg-emerald-700/40 text-emerald-300 border border-emerald-500/50 rounded-xl font-bold hover:bg-emerald-700/60 transition-all shadow-lg shadow-emerald-500/10"
                >
                  Confirm
                </button>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('click');
                    socket.emit('heraldResponse', 'Denied');
                  }}
                  className="flex-1 py-[1vh] bg-red-900/40 text-red-300 border border-red-500/50 rounded-xl font-bold hover:bg-red-900/60 transition-all shadow-lg shadow-red-500/10"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

        {/* Voting */}
        {gameState.phase === 'Voting' && (me?.isAlive || gameState.ghostVoterId === me?.id) && !me?.vote && !gameState.titlePrompt && (
          <div className="flex gap-[1vw] sm:gap-[2vw] w-full justify-center h-full items-center">
            {gameState.detainedPlayerId === me?.id ? (
              <div className="text-purple-400 font-mono text-responsive-xs uppercase tracking-widest text-center animate-pulse">
                You are detained and cannot vote this round
              </div>
            ) : (
              <>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    socket.emit('vote', 'Aye');
                    playSound('stamp_aye');
                  }}
                  className={cn(
                    'flex-1 h-full max-h-[10vh] rounded-xl border-2 sm:border-4 flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95 shadow-lg',
                    getVoteStyles(user?.activeVotingStyle, 'Aye')
                  )}
                >
                  <span className="text-responsive-2xl sm:text-responsive-3xl font-thematic uppercase leading-none">
                    AYE!
                  </span>
                  <span className="text-responsive-xs font-mono uppercase tracking-widest opacity-60">
                    (YES)
                  </span>
                </button>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    socket.emit('vote', 'Nay');
                    playSound('stamp_nay');
                  }}
                  className={cn(
                    'flex-1 h-full max-h-[10vh] rounded-xl border-2 sm:border-4 flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95 shadow-lg',
                    getVoteStyles(user?.activeVotingStyle, 'Nay')
                  )}
                >
                  <span className="text-responsive-2xl sm:text-responsive-3xl font-thematic uppercase leading-none">
                    NAY!
                  </span>
                  <span className="text-responsive-xs font-mono uppercase tracking-widest opacity-60">
                    (NO)
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* President discard */}
        {gameState.phase === 'Legislative_President' && isPresident && !gameState.titlePrompt && (
          <div className="flex gap-[1vw] sm:gap-[2vw] w-full justify-center h-full items-center">
            <AnimatePresence>
              {gameState.drawnPolicies.map((p, i) => (
                <motion.button
                  key={`pres-${i}`}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('paper_slide');
                    socket.emit('presidentDiscard', i);
                  }}
                  className={cn(
                    'flex-1 h-full max-h-[12vh] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] active:scale-95 shadow-lg preserve-3d',
                    getPolicyStyles(user?.activePolicyStyle, p)
                  )}
                >
                  {p === 'Civil' ? (
                    <Scale className="w-[3vh] h-[3vh] sm:w-[4vh] sm:h-[4vh]" />
                  ) : (
                    <Eye className="w-[3vh] h-[3vh] sm:w-[4vh] sm:h-[4vh]" />
                  )}
                  <span className="text-responsive-xs font-mono uppercase tracking-widest">
                    Discard
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Chancellor enact */}
        {gameState.phase === 'Legislative_Chancellor' && isChancellor && !gameState.titlePrompt && (
          <div className="flex gap-[1vw] sm:gap-[2vw] w-full justify-center h-full items-center">
            <AnimatePresence>
              {gameState.chancellorPolicies.map((p, i) => (
                <motion.button
                  key={`chan-${i}`}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('gavel');
                    socket.emit('chancellorPlay', i);
                  }}
                  className={cn(
                    'flex-1 h-full max-h-[12vh] rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg preserve-3d',
                    getPolicyStyles(user?.activePolicyStyle, p)
                  )}
                >
                  {p === 'Civil' ? (
                    <Scale className="w-[3vh] h-[3vh] sm:w-[4vh] sm:h-[4vh]" />
                  ) : (
                    <Eye className="w-[3vh] h-[3vh] sm:w-[4vh] sm:h-[4vh]" />
                  )}
                  <span className="text-responsive-xs font-mono uppercase tracking-widest">
                    Enact
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Veto (chancellor can propose during Legislative_Chancellor) */}
        {gameState.phase === 'Legislative_Chancellor' &&
          isChancellor &&
          gameState.stateDirectives >= 5 && (
            <button
              onClick={() => {
                playSound('click');
                socket.emit('vetoRequest');
              }}
              className="absolute bottom-2 right-4 text-responsive-xs text-purple-400 font-mono uppercase tracking-widest hover:text-purple-300"
            >
              Propose Veto
            </button>
          )}

        {/* GameOver summary */}
        {gameState.phase === 'GameOver' && !isDebriefing && (
          <div className="flex flex-col gap-[1vh] w-full max-w-xs h-full justify-center">
            <div className="text-center p-[1vh] sm:p-[2vh] rounded-2xl border-2 mb-2 bg-card border-default text-muted">
              <div className="text-responsive-xl font-thematic tracking-wide uppercase">
                Game Over
              </div>
              <div className="text-responsive-xs font-mono uppercase tracking-widest">
                See Assembly Results
              </div>
            </div>
            <button
              onClick={onPlayAgain}
              className="py-[1vh] sm:py-[1.5vh] btn-primary font-thematic text-responsive-xl rounded-xl hover:bg-subtle transition-all shadow-xl shadow-white/5"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Censure Vote Status */}
        {gameState.phase === 'Censure_Action' && me?.isAlive && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center max-w-lg px-4">
              {me.censureVoteId 
                ? `Voted for ${gameState.players.find(p => p.id === me.censureVoteId)?.name || 'a player'}`
                : 'Select a player on their card to censure (exclude from next nomination)'}
            </div>
          </div>
        )}

        {/* Snap Election Volunteer */}
        {gameState.phase === 'Snap_Election' && me?.isAlive && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center mb-1">
              Any player may volunteer to be the next President.
            </div>
            {gameState.snapElectionVolunteers?.includes(me.id) ? (
              <div className="px-8 py-3 rounded-2xl bg-purple-900/40 border border-purple-500/50 text-purple-200 font-bold uppercase tracking-widest animate-pulse">
                Volunteered
              </div>
            ) : (
              <button
                onClick={() => {
                  playSound('click');
                  socket.emit('snapVolunteer');
                }}
                className="px-8 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-[0.2em] shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Volunteer
              </button>
            )}
            <div className="text-[10px] font-mono text-faint uppercase mt-1">
              {gameState.snapElectionVolunteers?.length || 0} Ready to serve
            </div>
          </div>
        )}

        {gameState.phase === 'Lobby' &&
          !gameState.titlePrompt &&
          !isDebriefing &&
          (() => {
            const isHost = !!(user?.id && gameState.hostUserId === user.id);
            const readyCount = gameState.players.filter((p) => !p.isAI && p.isReady).length;
            const totalHuman = gameState.players.filter((p) => !p.isAI).length;
            const canForceStart =
              totalHuman >= 1 && (gameState.mode !== 'Ranked' || totalHuman >= 5);

            return (
              <div className="flex gap-[1.5vh] w-full h-full items-center justify-center px-[1vw]">
                {/* Ready Up */}
                <div className="flex flex-col gap-[0.5vh] items-center flex-1 max-w-[18vh]">
                  <button
                    onClick={() => {
                      playSound('click');
                      socket.emit('toggleReady');
                    }}
                    className={cn(
                      'w-full py-[1.5vh] font-thematic text-responsive-xl rounded-xl shadow-xl transition-all active:scale-95',
                      me?.isReady
                        ? 'bg-emerald-500 text-white shadow-emerald-500/10'
                        : 'btn-primary shadow-white/5'
                    )}
                  >
                    {me?.isReady ? 'Ready!' : 'Ready Up'}
                  </button>
                  <span className="text-responsive-xs uppercase tracking-widest text-muted">
                    {readyCount} / {totalHuman} Ready
                  </span>
                </div>

                {/* Host controls */}
                {isHost && (
                  <div className="flex flex-col gap-[0.5vh] shrink-0">
                    <div className="flex gap-[1vh]">
                      {/* Lock / Unlock */}
                      <Tooltip content={gameState.isLocked ? 'Unlock Room' : 'Lock Room'}>
                        <button
                          aria-label={gameState.isLocked ? 'Unlock Room' : 'Lock Room'}
                          onClick={() => {
                            playSound('click');
                            socket.emit('toggleLock');
                          }}
                          className={cn(
                            'p-[1.2vh] rounded-xl border transition-all active:scale-95',
                            gameState.isLocked
                              ? 'bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/40'
                              : 'bg-card border-subtle text-muted hover:border-default hover:text-primary'
                          )}
                        >
                          {gameState.isLocked ? (
                            <Lock className="w-[2vh] h-[2vh]" />
                          ) : (
                            <Unlock className="w-[2vh] h-[2vh]" />
                          )}
                        </button>
                      </Tooltip>

                      {/* Force Start */}
                      <Tooltip
                        content={
                          canForceStart
                            ? 'Force Start Game'
                            : gameState.mode === 'Ranked'
                              ? 'Need 5+ players for Ranked'
                              : 'No players'
                        }
                      >
                        <button
                          aria-label="Force Start Game"
                          onClick={() => {
                            if (canForceStart) {
                              playSound('click');
                              socket.emit('hostStartGame');
                            }
                          }}
                          disabled={!canForceStart}
                          className={cn(
                            'p-[1.2vh] rounded-xl border transition-all active:scale-95',
                            canForceStart
                              ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/30'
                              : 'bg-card border-subtle text-ghost cursor-not-allowed opacity-50'
                          )}
                        >
                          <Play className="w-[2vh] h-[2vh]" />
                        </button>
                      </Tooltip>
                    </div>
                    <span className="text-[8px] font-mono text-faint uppercase tracking-widest text-center">
                      Host
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
      </div>

      {/* Log bar */}
      <button
        onMouseEnter={() => playSound('hover')}
        onClick={() => {
          playSound('click');
          onOpenLog();
        }}
        className="h-[5vh] sm:h-[6vh] px-[2vw] flex items-center gap-3 bg-elevated hover:bg-surface transition-colors border-t border-subtle group"
      >
        <Scroll className="w-[2vh] h-[2vh] text-primary group-hover:text-red-500 transition-colors" />
        <div className="flex-1 text-responsive-xs text-muted truncate text-left italic">
          {lastEntry}
        </div>
        <div className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">Log</div>
      </button>
    </motion.div>
  );
};


