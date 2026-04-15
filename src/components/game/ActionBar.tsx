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
import { useTranslation } from '../../contexts/I18nContext';

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

  const { t } = useTranslation();

  const phaseLabel = () => {
    switch (gameState.phase) {
      case 'Lobby':
        return t('game.phases.lobby', { current: gameState.players.length, max: gameState.maxPlayers });
      case 'Nominate_Chancellor':
        return t('game.phases.nominate_chancellor', { name: gameState.players[gameState.presidentIdx]?.name });
      case 'Nomination_Review':
        if (gameState.titlePrompt?.role === 'Interdictor')
          return t('game.phases.interdictor_review');
        if (gameState.titlePrompt?.role === 'Broker') return t('game.phases.broker_review');
        return t('game.phases.nomination_review');
      case 'Voting':
      case 'Voting_Reveal':
        return t('game.phases.voting');
      case 'Legislative_President':
        if (gameState.titlePrompt?.role === 'Strategist')
          return t('game.phases.strategist_deck');
        return t('game.phases.legislative_president');
        if (gameState.lastEnactedPolicy) return t('game.action_bar.declaring');
        return t('game.phases.legislative_chancellor');
      case 'Auditor_Action':
        return t('game.phases.auditor_inspect');
      case 'Defector_Action':
        return t('game.phases.defector_align');
      case 'Quorum_Action':
        return t('game.phases.quorum_revote');
      case 'Assassin_Action':
        return t('game.phases.assassin_target');
      case 'Handler_Action':
        return t('game.action_bar.handler_active');
      case 'Censure_Action':
        return t('game.action_bar.censure_debate');
      case 'Snap_Election':
        return t('game.action_bar.snap_volunteers');
      case 'Event_Reveal':
        return t('game.action_bar.crisis_incoming');
      case 'Executive_Action':
        switch (gameState.currentExecutiveAction) {
          case 'Investigate':
            return t('game.action_bar.investigating');
          case 'SpecialElection':
            return t('game.action_bar.calling_special');
          case 'Execution':
            return t('game.action_bar.executing');
          case 'PolicyPeek':
            return t('game.action_bar.peeking');
          default:
            return t('game.action_bar.deciding');
        }
      case 'GameOver':
        return t('game.action_bar.victorious', { faction: gameState.winner === 'Civil' ? t('game.tracks.civil_label') : t('game.tracks.state_label') });
      default:
        return t('game.action_bar.in_session');
    }
  };

  const phaseHint = () => {
    const isPresident = me?.isPresidentialCandidate || me?.isPresident;
    const isChancellor = me?.isChancellorCandidate || me?.isChancellor;
    switch (gameState.phase) {
      case 'Nominate_Chancellor':
        return isPresident
          ? t('game.action_bar.nominate_prompt')
          : t('game.action_bar.nominate_watch');
      case 'Voting':
        return me?.id === gameState.detainedPlayerId
          ? t('game.action_bar.detained_cant_vote')
          : t('game.action_bar.voting_prompt');
      case 'Legislative_President':
        return isPresident
          ? t('game.action_bar.discard_prompt')
          : t('game.action_bar.pass_watch');
      case 'Legislative_Chancellor':
        if (gameState.lastEnactedPolicy) {
          return t('game.action_bar.declaration_hint');
        }
        return isChancellor
          ? t('game.action_bar.enact_prompt')
          : t('game.action_bar.enact_watch');
      case 'Executive_Action':
        if (isPresident) {
          switch (gameState.currentExecutiveAction) {
            case 'Investigate':
              return t('game.action_bar.investigate_prompt');
            case 'SpecialElection':
              return t('game.action_bar.special_prompt');
            case 'Execution':
              return t('game.action_bar.execute_prompt');
            case 'PolicyPeek':
              return t('game.action_bar.peek_prompt');
            default:
              return t('game.action_bar.must_use_power');
          }
        }
        return t('game.action_bar.pres_must_use');
      case 'Lobby':
        return t('game.action_bar.lobby_ready_prompt');
      default:
        return '\u00A0';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
      className="shrink-0 border-t border-subtle flex flex-col relative"
    >
      <AnimatePresence>
        {gameState.activeCipherMessage && (Date.now() - gameState.activeCipherMessage.timestamp < 8000) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="absolute inset-x-0 bottom-full z-[100] px-[2vw] pb-[2vh] pointer-events-none"
          >
            <div className="bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-2xl px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-mono text-emerald-400 uppercase tracking-[0.3em] font-bold">
                  {t('game.action_bar.anonymous_dispatch')}
                </span>
              </div>
              <div className="text-responsive-sm sm:text-responsive-md text-emerald-100 font-serif italic leading-relaxed">
                "{gameState.activeCipherMessage.text}"
              </div>
              <div className="mt-3 w-12 h-0.5 bg-emerald-500/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 8, ease: "linear" }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase status */}
      <div className="px-[2vw] py-[1.5vh] bg-surface-glass border-b border-subtle flex justify-between items-center">
        <div className="min-w-0 flex-1 mr-2 flex flex-col justify-center">
          <div className="text-responsive-xs uppercase tracking-[0.2em] text-muted font-light mb-1">
            {t('game.action_bar.current_phase')}
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
                  {t('game.action_bar.crisis_active')}
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
            <Tooltip position="top" content={t('game.action_bar.quick_reactions')}>
              <button
                aria-label={t('game.action_bar.toggle_reactions')}
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

          <Tooltip position="top" content={isVoiceActive ? t('game.action_bar.mute') : t('game.action_bar.unmute')}>
            <button
              aria-label={isVoiceActive ? t('game.action_bar.mute') : t('game.action_bar.unmute')}
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
          <Tooltip position="top" content={isVideoActive ? t('game.action_bar.stop_video') : t('game.action_bar.start_video')}>
            <button
              aria-label={isVideoActive ? t('game.action_bar.stop_video') : t('game.action_bar.start_video')}
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
      <div className="px-[2vw] py-[1vh] sm:py-[1.5vh] h-[12vh] sm:h-[15vh] flex items-center justify-center relative bg-elevated">
        {/* Cipher Input Overlay (Parallel) */}
        {showCipherInput && (
          <div className="absolute inset-0 z-50 bg-base/95 backdrop-blur-xl flex items-center justify-center px-4 animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">
                  {t('game.action_bar.encrypted_dispatch')}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder={t('game.action_bar.cipher_placeholder')}
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
                  {t('common.submit')}
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
        {gameState.titlePrompt && gameState.titlePrompt.playerId === me?.id && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            {[
              'Strategist',
              'Broker',
              'Handler',
              'Auditor',
              'Archivist',
              'Defector',
              'Quorum',
            ].includes(gameState.titlePrompt.role) ? (
              <>
                <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center">
                  {gameState.titlePrompt.role === 'Strategist' && t('game.action_bar.title_strategist_prompt')}
                  {gameState.titlePrompt.role === 'Broker' && t('game.action_bar.title_broker_prompt')}
                  {gameState.titlePrompt.role === 'Handler' && t('game.action_bar.title_handler_prompt')}
                  {gameState.titlePrompt.role === 'Auditor' && t('game.action_bar.title_auditor_prompt')}
                  {gameState.titlePrompt.role === 'Archivist' && t('game.action_bar.title_archivist_prompt')}
                  {gameState.titlePrompt.role === 'Defector' && t('game.action_bar.title_defector_prompt')}
                  {gameState.titlePrompt.role === 'Quorum' && t('game.action_bar.title_quorum_prompt')}
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
                    {gameState.titlePrompt.role === 'Defector' ? t('game.action_bar.title_flip_vote') : t('game.action_bar.title_yes')}
                  </button>
                  <button
                    onMouseEnter={() => playSound('hover')}
                    onClick={() => {
                      playSound('click');
                      socket.emit('useTitleAbility', { use: false });
                    }}
                    className="flex-1 py-[1vh] bg-subtle text-primary rounded-xl font-bold hover:bg-muted-bg transition-all"
                  >
                    {t('game.action_bar.title_no')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center">
                  {gameState.titlePrompt.role === 'Assassin' && t('game.action_bar.title_assassin_prompt')}
                  {gameState.titlePrompt.role === 'Interdictor' && t('game.action_bar.title_interdictor_prompt')}
                </div>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={() => {
                    playSound('click');
                    socket.emit('useTitleAbility', { use: false });
                  }}
                  className="px-[4vw] py-[1vh] bg-subtle text-primary rounded-xl font-bold hover:bg-muted-bg transition-all"
                >
                  {t('game.action_bar.skip_power')}
                </button>
              </>
            )}
          </div>
        )}



        {/* Voting */}
        {gameState.phase === 'Voting' && (me?.isAlive || gameState.ghostVoterId === me?.id) && !me?.vote && !gameState.titlePrompt && (
          <div className="flex gap-[1vw] sm:gap-[2vw] w-full justify-center h-full items-center">
            {gameState.detainedPlayerId === me?.id ? (
              <div className="text-purple-400 font-mono text-responsive-xs uppercase tracking-widest text-center animate-pulse">
                {t('game.voting.detained')}
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
                    {t('game.voting.aye')}
                  </span>
                  <span className="text-responsive-xs font-mono uppercase tracking-widest opacity-60">
                    {t('game.voting.aye_sub')}
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
                    {t('game.voting.nay')}
                  </span>
                  <span className="text-responsive-xs font-mono uppercase tracking-widest opacity-60">
                    {t('game.voting.nay_sub')}
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
                    {t('game.legislative.discard')}
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
                    {t('game.legislative.enact')}
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
              className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] text-purple-400 font-mono uppercase tracking-widest hover:text-purple-300 bg-black/40 px-3 py-0.5 rounded-full backdrop-blur-sm border border-purple-400/20"
            >
              {t('game.legislative.propose_veto')}
            </button>
          )}

        {/* Cipher Power Button */}
        {gameState.phase === 'Voting' &&
          me?.titleRole === 'Cipher' &&
          !me?.cipherUsed && (
            <button
              onClick={() => {
                playSound('click');
                setShowCipherInput(true);
              }}
              className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] text-emerald-400 font-mono uppercase tracking-widest hover:text-emerald-300 bg-black/40 px-3 py-0.5 rounded-full backdrop-blur-sm border border-emerald-400/20"
            >
              {t('game.legislative.send_dispatch')}
            </button>
          )}

        {/* GameOver summary */}
        {gameState.phase === 'GameOver' && !isDebriefing && (
          <div className="flex flex-col gap-[1vh] w-full max-w-xs h-full justify-center">
            <div className="text-center p-[1vh] sm:p-[2vh] rounded-2xl border-2 mb-2 bg-card border-default text-muted">
              <div className="text-responsive-xl font-thematic tracking-wide uppercase">
                {t('game.action_bar.game_over_title')}
              </div>
              <div className="text-responsive-xs font-mono uppercase tracking-widest">
                {t('game.action_bar.see_results')}
              </div>
            </div>
            <button
              onClick={onPlayAgain}
              className="py-[1vh] sm:py-[1.5vh] btn-primary font-thematic text-responsive-xl rounded-xl hover:bg-subtle transition-all shadow-xl shadow-white/5"
            >
              {t('game.action_bar.play_again')}
            </button>
          </div>
        )}

        {/* Censure Vote Status */}
        {gameState.phase === 'Censure_Action' && me?.isAlive && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center max-w-lg px-4">
              {me.censureVoteId
                ? t('game.action_bar.voted_for', { name: gameState.players.find(p => p.id === me.censureVoteId)?.name || '' })
                : t('game.action_bar.censure_select')}
            </div>
          </div>
        )}

        {/* Snap Election Volunteer */}
        {gameState.phase === 'Snap_Election' && me?.isAlive && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center">
            <div className="text-responsive-xs font-mono uppercase tracking-widest text-muted text-center mb-1">
              {t('game.action_bar.snap_volunteer_prompt')}
            </div>
            {gameState.snapElectionVolunteers?.includes(me.id) ? (
              <div className="px-8 py-3 rounded-2xl bg-purple-900/40 border border-purple-500/50 text-purple-200 font-bold uppercase tracking-widest animate-pulse">
                {t('game.action_bar.volunteered')}
              </div>
            ) : (
              <button
                onClick={() => {
                  playSound('click');
                  socket.emit('snapVolunteer');
                }}
                className="px-8 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-[0.2em] shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95"
              >
                {t('game.action_bar.volunteer')}
              </button>
            )}
            <div className="text-[10px] font-mono text-faint uppercase mt-1">
              {t('game.action_bar.ready_to_serve', { count: gameState.snapElectionVolunteers?.length || 0 })}
            </div>
          </div>
        )}


        {/* Spectator Prediction */}
        {!me && gameState.phase !== 'Lobby' && gameState.phase !== 'GameOver' && gameState.round <= 1 && user && (
          <div className="flex flex-col gap-[1vh] w-full justify-center h-full items-center p-4">
            {gameState.spectatorPredictions?.[user.id] ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-primary font-mono text-responsive-xs uppercase tracking-[0.2em] text-center animate-pulse">
                  Prediction Logged: {gameState.spectatorPredictions[user.id].prediction} Victory
                </div>
                <div className="text-[10px] text-faint font-light">
                  50 IP will be credited if your faction prevails.
                </div>
              </div>
            ) : (
              <>
                <div className="text-responsive-xs font-mono uppercase tracking-[0.15em] text-muted text-center mb-1">
                  Predict Unity or Deception for <span className="text-yellow-500 font-bold">50 IP</span>
                </div>
                <div className="flex gap-[2vw] w-full max-w-[400px]">
                  <button
                    onClick={() => {
                      playSound('click');
                      socket.emit('spectatorPredict', { prediction: 'Civil' });
                    }}
                    className="flex-1 py-[1.2vh] sm:py-[1.5vh] bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 hover:border-blue-500/60 text-blue-400 rounded-xl font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/5 group"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Scale className="w-3 h-3 group-hover:scale-110 transition-transform" />
                      Civil
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      socket.emit('spectatorPredict', { prediction: 'State' });
                    }}
                    className="flex-1 py-[1.2vh] sm:py-[1.5vh] bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 hover:border-red-500/60 text-red-400 rounded-xl font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-red-500/5 group"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Eye className="w-3 h-3 group-hover:scale-110 transition-transform" />
                      State
                    </span>
                  </button>
                </div>
              </>
            )}
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
                    {me?.isReady ? t('common.ready') : t('common.not_ready')}
                  </button>
                  <span className="text-responsive-xs uppercase tracking-widest text-muted">
                    {t('game.action_bar.ready_count', { count: readyCount, total: totalHuman })}
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
                      {t('game.action_bar.host_label')}
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
        className="h-[5vh] sm:h-[6vh] px-[2vw] flex items-center gap-3 bg-log-bar transition-colors border-t border-white/8 group"
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


