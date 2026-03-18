import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { GameState, Player, Role, Policy, User, PrivateInfo, PostMatchResult } from '../types';
import { getBackgroundTexture } from '../lib/cosmetics';
import { cn, getProxiedUrl } from '../lib/utils';
import * as aiSpeech from '../services/aiSpeech';
import * as geminiSpeech from '../services/geminiSpeech';

import { GameHeader } from './game/GameHeader';
import { PolicyTracks } from './game/PolicyTracks';
import { PlayerGrid } from './game/PlayerGrid';
import { ActionBar } from './game/ActionBar';
import { PauseOverlay } from './game/PauseOverlay';
import { PolicyAnimation } from './game/PolicyAnimation';

import { AssemblyLog } from './game/panels/AssemblyLog';
import { RoundHistory } from './game/panels/RoundHistory';
import { ChatPanel } from './game/panels/ChatPanel';

import { GameOverModal } from './game/modals/GameOverModal';
import { InvestigationModal } from './game/modals/InvestigationModal';
import { PolicyPeekModal } from './game/modals/PolicyPeekModal';
import { DossierModal } from './game/modals/DossierModal';
import { DeclarationModal } from './game/modals/DeclarationModal';
import { PlayerProfileModal } from './game/modals/PlayerProfileModal';
import { TitleAbilityModal } from './game/modals/TitleAbilityModal';
import { GameReferencePanel } from './game/GameReferencePanel';

const CLIENT_VERSION = 'v0.8.10';

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
  ttsVoice: string;
  ttsEngine: string;
  isAiVoiceEnabled: boolean;
  uiScaleSetting: number;
}

export const GameRoom = ({
  gameState, privateInfo, user, token,
  onLeaveRoom, onPlayAgain, onOpenProfile, onJoinRoom,
  setUser, setGameState, setPrivateInfo,
  updateAvailable,
  playSound, soundVolume, ttsVoice, ttsEngine, isAiVoiceEnabled,
  uiScaleSetting
}: GameRoomProps) => {
  const me = gameState.players.find(p => p.id === socket.id);
  const isSpectator = !me && gameState.spectators.some(s => s.id === socket.id);
  const [inQueue, setInQueue] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      const w = containerRef.current.clientWidth;
      
      // Target height is around 850px for full desktop experience
      // Target width is around 1200px
      const scaleH = h / 850;
      const scaleW = w / 1200;
      
      // On mobile we don't want to scale down too much as it's already small
      const isMobile = w < 640;
      const autoScale = isMobile ? 1 : Math.min(scaleH, scaleW, 1);
      const finalScale = autoScale * uiScaleSetting;
      setUiScale(Math.max(0.4, Math.min(finalScale, 2)));
    };
    
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [uiScaleSetting]);

  // ── UI panels ────────────────────────────────────────────────────────────
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [postMatchResult, setPostMatchResult] = useState<PostMatchResult | null>(null);
  const [chatText, setChatText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatGhostRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasNewMessages = !isChatOpen && gameState.messages
    .slice(lastSeenMessageCount)
    .some(m => m.type !== 'round_separator' && m.type !== 'declaration' && m.type !== 'failed_election');

  useEffect(() => {
    if (isChatOpen) setLastSeenMessageCount(gameState.messages.length);
  }, [isChatOpen, gameState.messages.length]);

  // Auto-open dossier at the start of the game (Round 1)
  const hasAutoOpenedDossier = useRef(false);
  useEffect(() => {
    if (!isSpectator && gameState.round === 1 && gameState.phase !== 'Lobby' && gameState.phase !== 'GameOver' && !hasAutoOpenedDossier.current) {
      setIsDossierOpen(true);
      hasAutoOpenedDossier.current = true;
    }
    // Reset if we go back to Lobby (e.g. Play Again)
    if (gameState.phase === 'Lobby') {
      hasAutoOpenedDossier.current = false;
    }
  }, [gameState.phase, gameState.round, isSpectator]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.messages, isChatOpen]);

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

  // ── Modals ───────────────────────────────────────────────────────────────
  const [peekedPolicies, setPeekedPolicies] = useState<Policy[] | null>(null);
  const [peekTitle, setPeekTitle] = useState<string | undefined>(undefined);
  const [investigationResult, setInvestigationResult] = useState<{ targetName: string; role: Role } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    socket.on('policyPeekResult', (policies: Policy[], title?: string) => {
      setPeekedPolicies(policies);
      setPeekTitle(title);
    });
    socket.on('investigationResult', (result) => setInvestigationResult(result));
    socket.on('postMatchResult', (result: PostMatchResult) => setPostMatchResult(result));
    return () => {
      socket.off('policyPeekResult');
      socket.off('investigationResult');
      socket.off('postMatchResult');
    };
  }, [token]);

  // ── Declaration state & logic ────────────────────────────────────────────
  const [showDeclarationUI, setShowDeclarationUI] = useState(false);
  const [declarationType, setDeclarationType] = useState<'President' | 'Chancellor' | null>(null);
  const [declCiv, setDeclCiv] = useState(0);
  const [declSta, setDeclSta] = useState(0);
  const [declDrawCiv, setDeclDrawCiv] = useState(0);
  const [declDrawSta, setDeclDrawSta] = useState(3);
  const [showPolicyAnim, setShowPolicyAnim] = useState(false);


  const showPolicyAnimRef = useRef(false);
  const pendingDeclarationRef = useRef<'President' | 'Chancellor' | null>(null);
  const chancellorSinceRef = useRef<number>(0);
  const wasChancellorRef = useRef(false);
  // Separate refs for each role's declaration prompt — avoids key collision bugs
  const presidentPromptedForRef = useRef<string>('');   // policyKey we already prompted president for
  const chancellorPromptedForRef = useRef<string>('');  // policyKey we already prompted chancellor for

  useEffect(() => { showPolicyAnimRef.current = showPolicyAnim; }, [showPolicyAnim]);

  // Track the initial policy broadcast (trackerReady=false) separately for animation
  const lastSeenPolicyIdRef = useRef<string>('');

  useEffect(() => {
    if (!gameState.lastEnactedPolicy) return;
    // Use type+playerId+approximate-time as a unique key for this policy event
    const key = `${gameState.lastEnactedPolicy.type}-${gameState.lastEnactedPolicy.playerId ?? ''}-${Math.floor(gameState.lastEnactedPolicy.timestamp / 10000)}`;
    if (key !== lastSeenPolicyIdRef.current) {
      lastSeenPolicyIdRef.current = key;
      setShowPolicyAnim(true);
    }
  }, [gameState.lastEnactedPolicy]);

  useEffect(() => {
    if (showPolicyAnim) {
      const timer = setTimeout(() => setShowPolicyAnim(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showPolicyAnim]);

  useEffect(() => {
    if (!showPolicyAnim && pendingDeclarationRef.current) {
      const type = pendingDeclarationRef.current;
      pendingDeclarationRef.current = null;
      setDeclarationType(type);
      if (type === 'President') {
        setDeclCiv(0); setDeclSta(2); setDeclDrawCiv(0); setDeclDrawSta(3);
      } else {
        setDeclCiv(0); setDeclSta(2);
      }
      setShowDeclarationUI(true);
    }
  }, [showPolicyAnim]);

  useEffect(() => {
    if (!me) return;
    const alreadyDeclared = gameState.declarations.some(d => d.playerId === socket.id);
    if (alreadyDeclared || gameState.phase === 'GameOver') {
      pendingDeclarationRef.current = null;
      setShowDeclarationUI(false);
      return;
    }
    if (me.isChancellor && !wasChancellorRef.current) chancellorSinceRef.current = Date.now();
    wasChancellorRef.current = !!me.isChancellor;

    const trackerReady = gameState.lastEnactedPolicy?.trackerReady === true;
    if (!trackerReady || !gameState.lastEnactedPolicy) return;

    // Stable policy key — use timestamp rounded to nearest second, not 10s bucket,
    // to avoid bucket-boundary mismatches between trackerReady=false and true broadcasts.
    const policyKey = `${gameState.lastEnactedPolicy.type}-${gameState.lastEnactedPolicy.playerId ?? ''}-${Math.floor(gameState.lastEnactedPolicy.timestamp / 1000)}`;

    let needed: 'President' | 'Chancellor' | null = null;

    // President: prompt once per policy
    if (me.isPresident && presidentPromptedForRef.current !== policyKey) {
      presidentPromptedForRef.current = policyKey;
      needed = 'President';
    }

    // Chancellor: prompt once per policy, but only after president has declared
    const presidentDeclared = gameState.declarations.some(d => d.type === 'President');
    if (me.isChancellor && presidentDeclared && chancellorPromptedForRef.current !== policyKey) {
      const policyEnactedThisTerm = (gameState.lastEnactedPolicy?.timestamp ?? 0) > chancellorSinceRef.current;
      if (policyEnactedThisTerm) {
        chancellorPromptedForRef.current = policyKey;
        needed = 'Chancellor';
      }
    }

    if (needed) {
      if (!showPolicyAnimRef.current) {
        pendingDeclarationRef.current = null;
        setDeclarationType(needed);
        if (needed === 'President') {
          setDeclCiv(0); setDeclSta(2); setDeclDrawCiv(0); setDeclDrawSta(3);
        } else {
          setDeclCiv(0); setDeclSta(2);
        }
        setShowDeclarationUI(true);
      } else {
        pendingDeclarationRef.current = needed;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.lastEnactedPolicy?.trackerReady, gameState.lastEnactedPolicy?.timestamp, gameState.declarations?.length, gameState.phase, showPolicyAnim]);

  const handleSubmitDeclaration = () => {
    socket.emit('declarePolicies', {
      civ: declCiv,
      sta: declSta,
      ...(declarationType === 'President' ? { drewCiv: declDrawCiv, drewSta: declDrawSta } : {}),
      type: declarationType,
    });
    setShowDeclarationUI(false);
  };

  // ── Timer tick ───────────────────────────────────────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Game sound effects on state change ──────────────────────────────────
  const prevPhase = useRef<string | undefined>(undefined);
  const prevVotes = useRef(0);
  const prevCivilDirectives = useRef(0);
  const prevStateDirectives = useRef(0);
  const prevAliveCount = useRef(0);

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === ttsVoice);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    const currentVotes = gameState.players.filter(p => p.vote).length;
    if (currentVotes > prevVotes.current && me && !me.vote) playSound('click');
    prevVotes.current = currentVotes;

    const currentAliveCount = gameState.players.filter(p => p.isAlive).length;
    if (prevAliveCount.current > 0 && currentAliveCount < prevAliveCount.current) playSound('death');
    prevAliveCount.current = currentAliveCount;

    if ((prevPhase.current === 'Voting' || prevPhase.current === 'Voting_Reveal') && 
        gameState.phase !== 'Voting' && gameState.phase !== 'Voting_Reveal') {
      if (gameState.phase === 'Legislative_President') playSound('election_passed');
      else if (gameState.phase === 'Nominate_Chancellor') playSound('election_failed');
    }

    if (gameState.civilDirectives > prevCivilDirectives.current) speak('Charter secured.');
    if (gameState.stateDirectives > prevStateDirectives.current) speak('The State advances.');
    prevCivilDirectives.current = gameState.civilDirectives;
    prevStateDirectives.current = gameState.stateDirectives;

    if (prevPhase.current !== 'GameOver' && gameState.phase === 'GameOver') {
      if (gameState.winner === 'Civil') playSound('win_civil');
      else if (gameState.winner === 'State') playSound('win_state');
    }

    prevPhase.current = gameState.phase;
  }, [gameState]);

  // ── Voice chat ───────────────────────────────────────────────────────────
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  
  useEffect(() => {
    aiSpeech.initVoices();
  }, []);

  useEffect(() => {
    if (!isAiVoiceEnabled) return;
    const lastMessage = gameState.messages[gameState.messages.length - 1];
    if (!lastMessage) return;
    
    const sender = gameState.players.find(p => p.name === lastMessage.sender);
    if (sender && sender.isAI) {
      if (ttsEngine === 'gemini') {
        const voice = geminiSpeech.getGeminiVoiceForAi(sender.name);
        geminiSpeech.generateGeminiSpeech({ text: lastMessage.text, voice }).then(audio => {
          if (audio) {
            audio.volume = soundVolume / 100;
            setSpeakingPlayers(prev => ({ ...prev, [sender.id]: true }));
            audio.onended = () => setSpeakingPlayers(prev => ({ ...prev, [sender.id]: false }));
            audio.play().catch(console.error);
          }
        });
      } else {
        const profile = aiSpeech.getVoiceProfileForAi(sender.name);
        if (profile) {
          aiSpeech.speakAiMessage(
            lastMessage.text, 
            sender.name, 
            profile,
            () => setSpeakingPlayers(prev4 => ({ ...prev4, [sender.id]: true })),
            () => setSpeakingPlayers(prev4 => ({ ...prev4, [sender.id]: false }))
          );
        }
      }
    }
  }, [gameState.messages.length, isAiVoiceEnabled, ttsEngine, soundVolume]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [speakingPlayers, setSpeakingPlayers] = useState<Record<string, boolean>>({});
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const setupSpeakingDetection = async (stream: MediaStream, playerId: string) => {
    if (!playerId) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') await context.resume();
      
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      
      const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isRunning = true;
      const check = () => {
        if (!isRunning) return;
        const isLocal = playerId === socket.id;
        const peerExists = !!peersRef.current[playerId];
        if (!isLocal && !peerExists) { isRunning = false; source.disconnect(); analyser.disconnect(); return; }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        if (sum / bufferLength > 10) {
          setSpeakingPlayers(prev => ({ ...prev, [playerId]: true }));
          if (speakingTimers.current[playerId]) clearTimeout(speakingTimers.current[playerId]);
          speakingTimers.current[playerId] = setTimeout(() => {
            setSpeakingPlayers(prev => ({ ...prev, [playerId]: false }));
          }, 400);
        }
        requestAnimationFrame(check);
      };
      check();
    } catch (err) {
      console.error('Voice detection error:', err);
    }
  };

  const createPeer = (peerId: string, initiator: boolean) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peersRef.current[peerId] = pc;
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('signal', { to: peerId, from: socket.id!, signal: { candidate: event.candidate } });
    };
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      setRemoteStreams(prev => {
        const existingStream = prev[peerId];
        if (existingStream) {
          // Check if we actually need to add any new tracks
          const newTracks = incomingStream.getTracks().filter(
            incoming => !existingStream.getTracks().find(existing => existing.id === incoming.id)
          );
          
          if (newTracks.length > 0) {
            // Create a NEW stream object containing all tracks to trigger React re-renders properly
            const mergedStream = new MediaStream([...existingStream.getTracks(), ...newTracks]);
            return { ...prev, [peerId]: mergedStream };
          }
          return prev;
        }
        return { ...prev, [peerId]: incomingStream };
      });

      // Cleanup and re-render when a track is removed or ends
      event.track.onended = () => {
        setRemoteStreams(prev => {
          const stream = prev[peerId];
          if (stream) {
            const activeTracks = stream.getTracks().filter(t => t.readyState !== 'ended');
            if (activeTracks.length === 0) {
              const newRemoteStreams = { ...prev };
              delete newRemoteStreams[peerId];
              return newRemoteStreams;
            }
            // Create new stream without the ended track
            return { ...prev, [peerId]: new MediaStream(activeTracks) };
          }
          return prev;
        });
      };
      
      if (incomingStream.getAudioTracks().length > 0) {
        setupSpeakingDetection(incomingStream, peerId);
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { to: peerId, from: socket.id!, signal: { sdp: offer } });
      } catch (err) { console.error('Negotiation error', err); }
    };
    return pc;
  };

  // Cleanup stale peer connections when players disconnect or leave
  useEffect(() => {
    Object.keys(peersRef.current).forEach(peerId => {
      if (peerId === socket.id) return;
      
      const player = gameState.players.find(p => p.id === peerId);
      if (!player || player.isDisconnected) {
        console.log('Cleaning up peer connection for:', peerId);
        const pc = peersRef.current[peerId];
        if (pc) {
          try {
            pc.close();
          } catch (e) {
            console.error('Error closing peer connection:', e);
          }
          delete peersRef.current[peerId];
          setRemoteStreams(prev => {
            if (!prev[peerId]) return prev;
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
      }
    });
  }, [gameState.players, socket.id]);

  useEffect(() => {
    socket.on('signal', async ({ from, signal }) => {
      let pc = peersRef.current[from];
      if (!pc) pc = createPeer(from, false);
      
      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { to: from, from: socket.id!, signal: { sdp: answer } });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (e) {
        console.error('Signal handling error:', e);
      }
    });

    socket.on('peerJoined', (peerId) => {
      console.log('Peer joined:', peerId);
      createPeer(peerId, true);
    });

    return () => {
      socket.off('signal');
      socket.off('peerJoined');
    };
  }, []); // Remove localStream dependency to keep listeners stable

  useEffect(() => {
    if (me && !me.isAlive) {
      setIsVoiceActive(false);
      setIsVideoActive(false);
    }
  }, [me?.isAlive]);

  useEffect(() => {
    if ((isVoiceActive || isVideoActive) && socket.id && localStream) {
      setupSpeakingDetection(localStream, socket.id);
    }
  }, [isVoiceActive, isVideoActive, localStream]);

  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (isVoiceActive || isVideoActive) {
      navigator.mediaDevices.getUserMedia({ audio: isVoiceActive, video: isVideoActive })
        .then(async stream => {
          setLocalStream(stream);
          
          // Update all active peer connections with new tracks
          Object.keys(peersRef.current).forEach(peerId => {
            const pc = peersRef.current[peerId];
            const senders = pc.getSenders();
            
            stream.getTracks().forEach(track => {
              const sender = senders.find(s => s.track?.kind === track.kind);
              if (sender) {
                sender.replaceTrack(track);
              } else {
                pc.addTrack(track, stream);
              }
            });
          });
        })
        .catch(err => { 
          console.error('Media error:', err); 
          setIsVoiceActive(false); 
          setIsVideoActive(false); 
        });
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
        Object.keys(peersRef.current).forEach(peerId => {
          const pc = peersRef.current[peerId];
          pc.getSenders().forEach(sender => {
            try {
              pc.removeTrack(sender);
            } catch (e) {
              console.warn('Error removing track:', e);
            }
          });
        });
      }
    }
  }, [isVoiceActive, isVideoActive]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
        onOpenChat={() => { playSound('click'); setIsChatOpen(true); }}
        onOpenHistory={() => { playSound('click'); setIsHistoryOpen(true); }}
        onOpenDossier={() => { playSound('click'); setIsDossierOpen(true); }}
        onOpenReference={() => { playSound('click'); setIsReferenceOpen(true); }}
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
          <PolicyTracks gameState={gameState} />

          <PlayerGrid
            gameState={gameState}
            me={me}
            speakingPlayers={speakingPlayers}
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
                  <span className="text-responsive-xs font-mono text-purple-400 uppercase tracking-[0.2em]">Spectating</span>
                  <span className="text-responsive-xs font-mono text-faint">— You can see all roles</span>
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
                    <p className="text-responsive-xs font-mono text-secondary">Game over — the next game is being set up.</p>
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
                    onClick={() => { socket.emit('leaveQueue'); setInQueue(false); playSound('click'); }}
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
              onOpenLog={() => { playSound('click'); setIsLogOpen(true); }}
              onPlayAgain={onPlayAgain}
              onLeaveRoom={onLeaveRoom}
              playSound={playSound}
              isVoiceActive={isVoiceActive}
              setIsVoiceActive={setIsVoiceActive}
              isVideoActive={isVideoActive}
              setIsVideoActive={setIsVideoActive}
            />
          )}

          {/* Overlays within main */}
          <PauseOverlay gameState={gameState} />

          <GameOverModal
            gameState={gameState}
            privateInfo={privateInfo}
            myId={socket.id}
            postMatchResult={postMatchResult}
            onPlayAgain={onPlayAgain}
            onLeave={onLeaveRoom}
            onOpenLog={() => setIsLogOpen(true)}
          />
        </div>
      </main>

      {/* Policy flip animation */}
      <PolicyAnimation gameState={gameState} show={showPolicyAnim} />

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
        />
      )}
      <InvestigationModal
        result={investigationResult}
        onClose={() => setInvestigationResult(null)}
      />
      <PolicyPeekModal
        policies={peekedPolicies}
        title={peekTitle}
        onClose={() => { setPeekedPolicies(null); setPeekTitle(undefined); }}
      />
      <DossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        privateInfo={privateInfo}
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
      />
      {gameState.titlePrompt && gameState.titlePrompt.playerId === socket.id && (
        <TitleAbilityModal
          role={gameState.titlePrompt.role}
          gameState={gameState}
          onClose={() => {}}
        />
      )}
      <GameReferencePanel
        isOpen={isReferenceOpen}
        onClose={() => setIsReferenceOpen(false)}
        gameState={gameState}
        me={me}
      />
    </div>
  );
};
