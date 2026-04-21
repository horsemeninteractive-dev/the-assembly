import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { socket } from '../socket';
import { GameState, Role, Policy, User, PrivateInfo, PostMatchResult } from '../../shared/types';
import { getBackgroundTexture } from '../utils/cosmetics';
import { cn, getProxiedUrl, debugLog, debugWarn, debugError, apiUrl } from '../utils/utils';
import * as aiSpeech from '../services/aiSpeech';


import { GameHeader } from './game/GameHeader';
import { PolicyTracks } from './game/PolicyTracks';
import { PlayerGrid } from './game/PlayerGrid';
import { ActionBar } from './game/ActionBar';
import { PauseOverlay } from './game/PauseOverlay';
import { PolicyAnimation } from './game/PolicyAnimation';
import { CrisisAnimation } from './game/CrisisAnimation';
import { PresidentPickAnimation } from './game/PresidentPickAnimation';

import { AssemblyLog } from './game/panels/AssemblyLog';
import { RoundHistory } from './game/panels/RoundHistory';
import { ChatPanel } from './game/panels/ChatPanel';

import { GameOverModal } from './game/modals/GameOverModal';
import { DebriefSequence } from './game/DebriefSequence';
import { InvestigationModal } from './game/modals/InvestigationModal';
import { PolicyPeekModal } from './game/modals/PolicyPeekModal';
import { DossierModal } from './game/modals/DossierModal';
import { DeclarationModal } from './game/modals/DeclarationModal';
import { PlayerProfileModal } from './game/modals/PlayerProfileModal';
import { KickVoteModal } from './game/modals/KickVoteModal';
import { GameReferencePanel } from './game/GameReferencePanel';
import { useScaling } from '../hooks/useScaling';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameSounds } from '../hooks/useGameSounds';
import { usePostMatchHandler } from '../hooks/usePostMatchHandler';
import { useLegislativeHandler } from '../hooks/useLegislativeHandler';


interface GameRoomProps {
  gameState: GameState;
  privateInfo: PrivateInfo | null;
  user: User | null;
  token: string | null;
  onLeaveRoom: () => void;
  onPlayAgain: () => void;
  onOpenProfile: () => void;
  onJoinRoom: (roomId: string) => void;
  setUser: (u: User) => void;
  setGameState: (gs: GameState | null) => void;
  setPrivateInfo: (info: PrivateInfo | null) => void;
  updateAvailable: boolean;
  playSound: (soundKey: string) => void;
  soundVolume: number;
  ttsVolume: number;
  ttsVoice: string;
  ttsEngine: string;
  isAiVoiceEnabled: boolean;
  uiScaleSetting: number;
}

export const GameRoom = ({
  gameState,
  privateInfo,
  user,
  token,
  onLeaveRoom,
  onPlayAgain,
  onOpenProfile,
  onJoinRoom,
  setUser,
  setGameState,
  setPrivateInfo,
  updateAvailable,
  playSound,
  soundVolume,
  ttsVolume,
  ttsVoice,
  ttsEngine,
  isAiVoiceEnabled,
  uiScaleSetting,
}: GameRoomProps) => {
  const me = gameState.players.find((p) => p.socketId === socket.id);
  const isSpectator = !me && gameState.spectators.some((s) => s.id === socket.id);
  const [inQueue, setInQueue] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const uiScale = useScaling(containerRef, { multiplier: uiScaleSetting });

  // Add this inside the component to check against sound settings
  const isSoundOn = localStorage.getItem('isSoundOn') !== 'false';

  // ── UI panels ────────────────────────────────────────────────────────────
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [postMatchResult, setPostMatchResult] = useState<PostMatchResult | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);

  // Trigger debrief sequence when the game ends
  useEffect(() => {
    if (gameState.phase === 'GameOver') {
      setShowDebrief(true);
    }
  }, [gameState.phase]);
  const [chatText, setChatText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatGhostRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleChatScroll = () => {
    if (chatInputRef.current && chatGhostRef.current) {
      chatGhostRef.current.scrollLeft = chatInputRef.current.scrollLeft;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      if (chatText.trim() === '/debug') {
        setShowDebug(true);
        setChatText('');
        return;
      }
      if (chatText.trim() === '/nodebug') {
        setShowDebug(false);
        setChatText('');
        return;
      }
      socket.emit('sendMessage', chatText.trim());
      setChatText('');
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    const input = chatInputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const before = chatText.substring(0, start);
      const after = chatText.substring(end);
      const newText = before + emoji + after;
      setChatText(newText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
        handleChatScroll();
      }, 0);
    }
  };

  const hasNewMessages =
    !isChatOpen &&
    gameState.messages
      .slice(lastSeenMessageCount)
      .some(
        (m) =>
          m.type !== 'round_separator' && m.type !== 'declaration' && m.type !== 'failed_election'
      );

  // ── Custom Hooks ──────────────────────────────────────────────────────────
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState<Record<string, boolean>>({});

  const { localStream, remoteStreams } = useWebRTC({
    gameState,
    me,
    token,
    socket,
    isVoiceActive,
    setIsVoiceActive,
    isVideoActive,
    setIsVideoActive,
    setSpeakingPlayers,
  });

  const [reactions, setReactions] = useState<Record<string, { reaction: string; timestamp: number }>>({});

  useEffect(() => {
    socket.on('reaction', ({ playerId, reaction }) => {
      setReactions((prev) => ({
        ...prev,
        [playerId]: { reaction, timestamp: Date.now() },
      }));
      
      // Auto-clear after 3 seconds
      setTimeout(() => {
        setReactions((prev) => {
          const current = prev[playerId];
          if (current && Date.now() - current.timestamp >= 3000) {
            const next = { ...prev };
            delete next[playerId];
            return next;
          }
          return prev;
        });
      }, 3000);
    });
    
    return () => {
      socket.off('reaction');
    };
  }, []);

  useEffect(() => {
    // Monitor connection health via a simple ping-pong
    const interval = setInterval(() => {
      if (!socket.connected) return;
      const start = Date.now();
      
      // If the server doesn't respond within 1.5s, mark as lagging
      const timeout = setTimeout(() => {
        socket.emit('setLagging', true);
      }, 1500);

      socket.emit('ping-server', () => {
        clearTimeout(timeout);
        const latency = Date.now() - start;
        // Threshold: 300ms for lagging
        if (latency > 300) {
          socket.emit('setLagging', true);
        } else {
          socket.emit('setLagging', false);
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const [peekedPolicies, setPeekedPolicies] = useState<Policy[] | null>(null);
  const [peekTitle, setPeekTitle] = useState<string | undefined>(undefined);
  const [investigationResult, setInvestigationResult] = useState<{
    targetName: string;
    role: Role;
  } | null>(null);

  usePostMatchHandler({
    socket,
    token,
    setPeekedPolicies,
    setPeekTitle,
    setInvestigationResult,
    setPostMatchResult,
  });

  const {
    showDeclarationUI,
    declarationType,
    declCiv,
    declSta,
    declDrawCiv,
    declDrawSta,
    setDeclCiv,
    setDeclSta,
    setDeclDrawCiv,
    setDeclDrawSta,
    showPolicyAnim,
    handleSubmitDeclaration,
  } = useLegislativeHandler({ gameState, me, socket });

  const [activeCrisisToReveal, setActiveCrisisToReveal] = useState<typeof gameState.activeEventCard | null>(null);
  const lastCrisisKeyRef = useRef<string>('');

  const handleCrisisComplete = useCallback(() => {
    setActiveCrisisToReveal(null);
  }, []);

  useEffect(() => {
    // Only SET the animation when a NEW card arrives — never clear it here.
    // Dismissal is handled exclusively by the 5s internal timer via onComplete.
    // Clearing from server state caused the double-play flicker.
    if (!gameState.activeEventCard) return;
    const key = `${gameState.activeEventCard.id}-${gameState.round}`;
    if (key !== lastCrisisKeyRef.current) {
      lastCrisisKeyRef.current = key;
      setActiveCrisisToReveal(gameState.activeEventCard);
    }
  }, [gameState.activeEventCard, gameState.round]);

  // Reset the key tracker when the game ends or resets so the next game can show cards again
  useEffect(() => {
    if (gameState.phase === 'Lobby') {
      lastCrisisKeyRef.current = '';
    }
  }, [gameState.phase]);

  // ── President pick animation ──────────────────────────────────────────────
  const [showPresidentPick, setShowPresidentPick] = useState(false);
  const hasShownPresidentPickRef = useRef(false);

  useEffect(() => {
    if (
      gameState.round === 1 &&
      gameState.phase === 'Nominate_Chancellor' &&
      !hasShownPresidentPickRef.current
    ) {
      hasShownPresidentPickRef.current = true;
      setShowPresidentPick(true);
    }
    // Reset for next game
    if (gameState.phase === 'Lobby') {
      hasShownPresidentPickRef.current = false;
      setShowPresidentPick(false);
    }
  }, [gameState.round, gameState.phase]);

  useGameSounds({
    gameState,
    me,
    playSound,
    isSoundOn,
    ttsVoice,
    ttsVolume,
    isAiVoiceEnabled,
    ttsEngine,
    soundVolume,
    isLogOpen,
    isChatOpen,
    isHistoryOpen,
    isDossierOpen,
    isReferenceOpen,
    peekedPolicies,
    investigationResult,
    showDeclarationUI,
    selectedPlayerId,
    setSpeakingPlayers,
  });

  // ── UI Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isChatOpen) {
      setLastSeenMessageCount(gameState.messages.length);
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isChatOpen, gameState.messages.length]);

  const hasAutoOpenedDossier = useRef(false);
  useEffect(() => {
    if (
      !isSpectator &&
      gameState.round === 1 &&
      gameState.phase !== 'Lobby' &&
      gameState.phase !== 'GameOver' &&
      !hasAutoOpenedDossier.current
    ) {
      setIsDossierOpen(true);
      hasAutoOpenedDossier.current = true;
    }
    if (gameState.phase === 'Lobby') hasAutoOpenedDossier.current = false;
  }, [gameState.phase, gameState.round, isSpectator]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKick = (targetId: string) => {
    const isHost = !!(user?.id && gameState.hostUserId === user.id);
    if (isHost) {
      socket.emit('kickPlayer', targetId);
    } else {
      socket.emit('initiateKickVote', targetId);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 w-full text-primary font-sans grid grid-rows-[auto_1fr] overflow-hidden transition-all duration-1000',
        gameState.stateDirectives >= 3 && gameState.phase !== 'GameOver' && 'danger-zone-pulse'
      )}
    >
      <GameHeader
        gameState={gameState}
        me={me}
        socketId={socket.id}
        user={user}
        privateInfo={privateInfo}
        hasNewMessages={hasNewMessages}
        tick={0}
        onOpenChat={() => {
          playSound('click');
          setIsChatOpen(true);
        }}
        onOpenHistory={() => {
          playSound('click');
          setIsHistoryOpen(true);
        }}
        onOpenDossier={() => {
          playSound('click');
          setIsDossierOpen(true);
        }}
        onOpenReference={() => {
          playSound('click');
          setIsReferenceOpen(true);
        }}
        onOpenProfile={onOpenProfile}
        onLeaveRoom={onLeaveRoom}
        playSound={playSound}
      />

      <main className="relative overflow-hidden w-full h-full">
        <div
          className="absolute top-0 left-0 flex flex-col origin-top-left transition-all duration-300"
          style={{
            transform: `scale(${uiScale})`,
            width: `${100 / uiScale}%`,
            height: `${100 / uiScale}%`,
          }}
        >
          <PolicyTracks gameState={gameState} user={user} playSound={playSound} />

          <PlayerGrid
            gameState={gameState}
            me={me}
            speakingPlayers={speakingPlayers}
            reactions={reactions}
            playSound={playSound}
            token={token || ''}
            selectedPlayerId={selectedPlayerId}
            setSelectedPlayerId={setSelectedPlayerId}
            localStream={localStream}
            remoteStreams={remoteStreams}
            isVideoActive={isVideoActive}
            isSpectator={isSpectator}
            isHost={!!(user?.id && gameState.hostUserId === user.id)}
          />

          {isSpectator ? (
            <div className="shrink-0 bg-elevated border-t border-subtle flex flex-col">
              {/* Spectator status bar */}
              <div className="px-[2vw] py-[1.5vh] bg-white/5 border-b border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-responsive-xs font-mono text-purple-400 uppercase tracking-[0.2em]">
                    Spectating
                  </span>
                  <span className="text-responsive-xs font-mono text-faint">
                    — You can see all roles
                  </span>
                </div>
                <button
                  onClick={onLeaveRoom}
                  className="text-responsive-xs font-mono text-ghost hover:text-primary uppercase tracking-widest transition-colors"
                >
                  Leave
                </button>
              </div>
              {/* Queue section */}
              <div className="px-[2vw] py-[1.5vh] flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {gameState.phase === 'GameOver' ? (
                    <p className="text-responsive-xs font-mono text-secondary">
                      Game over — the next game is being set up.
                    </p>
                  ) : (
                    <p className="text-responsive-xs font-mono text-secondary">
                      {gameState.spectatorQueue?.length
                        ? `${gameState.spectatorQueue.length} in queue for next game`
                        : 'Queue up to join the next game when it starts.'}
                    </p>
                  )}
                </div>
                {inQueue ? (
                  <button
                    onClick={() => {
                      socket.emit('leaveQueue');
                      setInQueue(false);
                      playSound('click');
                    }}
                    className="px-4 py-2 rounded-xl text-responsive-xs font-mono uppercase tracking-widest border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-all shrink-0"
                  >
                    Leave Queue
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      socket.emit('joinQueue', {
                        name: user?.username ?? 'Player',
                        userId: user?.id,
                        avatarUrl: user?.avatarUrl,
                        activeFrame: user?.activeFrame,
                        activePolicyStyle: user?.activePolicyStyle,
                        activeVotingStyle: user?.activeVotingStyle,
                      });
                      setInQueue(true);
                      playSound('click');
                    }}
                    className="px-4 py-2 rounded-xl text-responsive-xs font-mono uppercase tracking-widest border border-emerald-700/50 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30 transition-all shrink-0"
                  >
                    Join Next Game
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ActionBar
              gameState={gameState}
              me={me}
              user={user}
              showDebug={showDebug}
              onOpenLog={() => {
                playSound('click');
                setIsLogOpen(true);
              }}
              onPlayAgain={onPlayAgain}
              onLeaveRoom={onLeaveRoom}
              playSound={playSound}
              isVoiceActive={isVoiceActive}
              setIsVoiceActive={setIsVoiceActive}
              isVideoActive={isVideoActive}
              setIsVideoActive={setIsVideoActive}
              isDebriefing={showDebrief}
            />
          )}

          {/* Overlays within main */}
          <PauseOverlay gameState={gameState} />

          {showDebrief && (
            <DebriefSequence
              gameState={gameState}
              privateInfo={privateInfo}
              myId={me?.id}
              onComplete={() => setShowDebrief(false)}
              playSound={playSound}
            />
          )}

          {!showDebrief && (
            <GameOverModal
              gameState={gameState}
              privateInfo={privateInfo}
              myId={me?.id}
              postMatchResult={postMatchResult}
              onPlayAgain={onPlayAgain}
              onLeave={onLeaveRoom}
              onOpenLog={() => setIsLogOpen(true)}
              playSound={playSound}
            />
          )}
        </div>
      </main>

      {/* Policy flip animation */}
      <PolicyAnimation gameState={gameState} show={showPolicyAnim} playSound={playSound} />

      {/* Crisis event animation */}
      <AnimatePresence>
        {activeCrisisToReveal && (
          <CrisisAnimation 
            key={`crisis-anim-${lastCrisisKeyRef.current}`}
            gameState={gameState} 
            activeEvent={activeCrisisToReveal}
            playSound={playSound} 
            onComplete={handleCrisisComplete}
          />
        )}
      </AnimatePresence>

      {/* First president roulette animation */}
      {showPresidentPick && (() => {
        const president = gameState.players.find((p) => p.isPresidentialCandidate || p.isPresident);
        return president ? (
          <PresidentPickAnimation
            players={gameState.players}
            presidentId={president.id}
            playSound={playSound}
            onComplete={() => setShowPresidentPick(false)}
          />
        ) : null;
      })()}

      {/* Panels */}
      <AssemblyLog
        log={gameState.log}
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        showDebug={showDebug}
      />
      <RoundHistory
        gameState={gameState}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
      <ChatPanel
        gameState={gameState}
        me={me}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        chatText={chatText}
        setChatText={setChatText}
        onSend={handleSendMessage}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        onEmojiClick={onEmojiClick}
        chatEndRef={chatEndRef}
        chatInputRef={chatInputRef}
        chatGhostRef={chatGhostRef}
        onChatScroll={handleChatScroll}
        playSound={playSound}
      />

      {/* Modals */}
      {selectedPlayerId && (
        <PlayerProfileModal
          userId={selectedPlayerId}
          token={token || ''}
          onClose={() => setSelectedPlayerId(null)}
          playSound={playSound}
          onSendFriendRequest={(targetUserId) => socket.emit('sendFriendRequest', targetUserId)}
          isMe={selectedPlayerId === me?.id}
          isHost={!!(user?.id && gameState.hostUserId === user.id)}
          onKick={handleKick}
        />
      )}
      {gameState.kickVote && (
        <KickVoteModal
          gameState={gameState}
          me={me}
          onCastVote={(vote) => socket.emit('castKickVote', vote)}
          playSound={playSound}
        />
      )}
      <InvestigationModal
        result={investigationResult}
        onClose={() => setInvestigationResult(null)}
        playSound={playSound}
      />
      <PolicyPeekModal
        policies={peekedPolicies}
        title={peekTitle}
        onClose={() => {
          setPeekedPolicies(null);
          setPeekTitle(undefined);
        }}
        playSound={playSound}
      />
      <DossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        privateInfo={privateInfo}
        playSound={playSound}
      />
      <DeclarationModal
        show={showDeclarationUI}
        declarationType={declarationType}
        declCiv={declCiv}
        declSta={declSta}
        declDrawCiv={declDrawCiv}
        declDrawSta={declDrawSta}
        setDeclCiv={setDeclCiv}
        setDeclSta={setDeclSta}
        setDeclDrawCiv={setDeclDrawCiv}
        setDeclDrawSta={setDeclDrawSta}
        onSubmit={handleSubmitDeclaration}
        playSound={playSound}
        needsTotalDraw={gameState.isStrategistAction ? 4 : 3}
      />
      <GameReferencePanel
        isOpen={isReferenceOpen}
        onClose={() => setIsReferenceOpen(false)}
        gameState={gameState}
        me={me}
        playSound={playSound}
      />
    </div>
  );
};
