import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { GameState, Player, Role, Policy, User, PrivateInfo, PostMatchResult } from '../types';
import { getBackgroundTexture } from '../lib/cosmetics';
import { cn, getProxiedUrl } from '../lib/utils';
import * as aiSpeech from '../services/aiSpeech';

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
import { GameReferencePanel } from './game/GameReferencePanel';

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
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatGhostRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
    const handlePeek = (policies: Policy[], title?: string) => {
      setPeekedPolicies(policies);
      setPeekTitle(title);
    };
    const handleInvestigation = (result: { targetName: string; role: Role }) => {
      setInvestigationResult(result);
    };
    const handlePostMatch = (result: PostMatchResult) => {
      setPostMatchResult(result);
    };

    socket.on('policyPeekResult', handlePeek);
    socket.on('investigationResult', handleInvestigation);
    socket.on('postMatchResult', handlePostMatch);

    return () => {
      socket.off('policyPeekResult', handlePeek);
      socket.off('investigationResult', handleInvestigation);
      socket.off('postMatchResult', handlePostMatch);
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
    if (!declarationType) return;
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
    aiSpeech.speak(text, { 
      voice: ttsVoice,
      volume: soundVolume / 100,
      rate: 0.9,
      pitch: 0.8
    });
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

  // ── Panel sound effects ──────────────────────────────────────────────────
  const prevPanelsState = useRef({
    isLogOpen, isChatOpen, isHistoryOpen, isDossierOpen, isReferenceOpen,
    isPeekOpen: !!peekedPolicies,
    isInvestigationOpen: !!investigationResult,
    isDeclarationOpen: showDeclarationUI,
    isProfileOpen: !!selectedPlayerId
  });

  useEffect(() => {
    const current = {
      isLogOpen, isChatOpen, isHistoryOpen, isDossierOpen, isReferenceOpen,
      isPeekOpen: !!peekedPolicies,
      isInvestigationOpen: !!investigationResult,
      isDeclarationOpen: showDeclarationUI,
      isProfileOpen: !!selectedPlayerId
    };

    const opened = Object.keys(current).some(k => (current as any)[k] && !(prevPanelsState.current as any)[k]);
    const closed = Object.keys(current).some(k => !(current as any)[k] && (prevPanelsState.current as any)[k]);

    if (opened) playSound('modal_open');
    else if (closed) playSound('modal_close');

    prevPanelsState.current = current;
  }, [isLogOpen, isChatOpen, isHistoryOpen, isDossierOpen, isReferenceOpen, peekedPolicies, investigationResult, showDeclarationUI, selectedPlayerId]);

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

  // ── WebRTC — Perfect Negotiation Pattern ────────────────────────────────
  //
  // Key principle: ONLY onnegotiationneeded sends offers. Nothing else ever
  // calls createOffer directly. This eliminates all glare and race conditions.
  //
  // Each peer connection has a per-peer `makingOffer` flag and a `polite` flag.
  // The polite peer (lex-larger socket ID) backs off if both sides offer at once.
  // The impolite peer (lex-smaller socket ID) ignores incoming offers while making one.
  //
  // To trigger renegotiation from any side at any time, just call
  // addTrack on the pc — onnegotiationneeded does the rest.
  // We NEVER use replaceTrack(null) to "remove" a track — instead we just
  // stop the track and let the remote side see it end. On re-enable we
  // removeTrack the old sender and addTrack the new one so onnegotiationneeded fires.

  // Must be declared before createPeer, which closes over it.
  // Kept in sync synchronously (not via useEffect) to avoid one-render lag.
  const localStreamRef = useRef<MediaStream | null>(null);

  // Per-peer signaling metadata needed for perfect negotiation
  const peerMetaRef = useRef<Record<string, { makingOffer: boolean; polite: boolean }>>({});

  const destroyPeer = (peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try { pc.close(); } catch (e) { }
      delete peersRef.current[peerId];
    }
    delete peerMetaRef.current[peerId];
    setRemoteStreams(prev => {
      const next = { ...prev }; delete next[peerId]; return next;
    });
  };

  // Tracks the kind ('audio'|'video') for each RTCRtpSender we create,
  // so we can identify null-tracked senders after removeTrack.
  const senderKindMap = useRef(new WeakMap<RTCRtpSender, string>());

  // Push a track into a peer connection.
  // Removes any existing sender for this kind first — including null-tracked senders
  // left by removeTrack — so we never accumulate stale transceivers.
  const addTrackToPeer = (pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) => {
    console.log(`[WebRTC] addTrackToPeer kind=${track.kind} | senders=[${pc.getSenders().map(s => s.track?.kind ?? `null(was ${senderKindMap.current.get(s) ?? '?'})`).join(', ')}] | sigState=${pc.signalingState}`);
    pc.getSenders().forEach(s => {
      const kind = s.track?.kind ?? senderKindMap.current.get(s);
      if (kind === track.kind) {
        try { pc.removeTrack(s); } catch (e) { }
      }
    });
    const sender = pc.addTrack(track, stream); // fires onnegotiationneeded
    senderKindMap.current.set(sender, track.kind);
  };

  const createPeer = (peerId: string) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    // Polite = lex-larger ID. The polite peer rolls back when there's a glare.
    const polite = socket.id! > peerId;
    peerMetaRef.current[peerId] = { makingOffer: false, polite };

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peersRef.current[peerId] = pc;

    // Seed an empty stream so the video tile renders immediately
    setRemoteStreams(prev => ({ ...prev, [peerId]: new MediaStream() }));

    // Add whatever local tracks we already have. If we have none yet (camera
    // not on), this is a no-op and onnegotiationneeded won't fire — that's
    // fine; the remote side will offer when they add their tracks, and we'll
    // answer. When we turn our camera on later, addTrack fires onnegotiationneeded.
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => addTrackToPeer(pc, track, localStreamRef.current!));
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('signal', { to: peerId, from: socket.id!, signal: { candidate } });
    };

    pc.ontrack = ({ track }) => {
      console.log(`[WebRTC] ontrack peer=${peerId.slice(0,6)} kind=${track.kind} readyState=${track.readyState} muted=${track.muted}`);
      setRemoteStreams(prev => {
        const existing = prev[peerId] || new MediaStream();
        // Replace any existing track of the same kind rather than accumulating.
        // Accumulated stale tracks cause hasVideo to return true for ended tracks,
        // and the video element gets confused about which track to render.
        const otherTracks = existing.getTracks().filter(t => t.kind !== track.kind);
        const next = new MediaStream([...otherTracks, track]);
        return { ...prev, [peerId]: next };
      });

      track.onended = () => {
        console.log(`[WebRTC] track ended peer=${peerId.slice(0,6)} kind=${track.kind}`);
        setRemoteStreams(prev => {
          const st = prev[peerId];
          if (!st) return prev;
          const active = st.getTracks().filter(t => t !== track);
          if (active.length === 0) { const n = { ...prev }; delete n[peerId]; return n; }
          return { ...prev, [peerId]: new MediaStream(active) };
        });
      };

      if (track.kind === 'audio') {
        const audioStream = new MediaStream([track]);
        const init = () => setupSpeakingDetection(audioStream, peerId);
        track.onunmute = init;
        if (!track.muted) init();
      }
    };

    pc.onnegotiationneeded = async () => {
      const meta = peerMetaRef.current[peerId];
      if (!meta) return;
      console.log(`[WebRTC] onnegotiationneeded peer=${peerId.slice(0,6)} sigState=${pc.signalingState} makingOffer=${meta.makingOffer}`);
      try {
        meta.makingOffer = true;
        await pc.setLocalDescription(); // browser auto-creates offer
        console.log(`[WebRTC] offer sent to peer=${peerId.slice(0,6)}`);
        socket.emit('signal', { to: peerId, from: socket.id!, signal: { sdp: pc.localDescription } });
      } catch (err) {
        console.error('onnegotiationneeded error', err);
      } finally {
        meta.makingOffer = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state peer=${peerId.slice(0,6)} => ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        console.log(`[WebRTC] ICE ${pc.iceConnectionState} — destroying and recreating peer=${peerId.slice(0,6)}`);
        destroyPeer(peerId);
        createPeerRef.current(peerId);
      }
    };

    return pc;
  };

  // Stable ref so the signal handler never captures a stale createPeer closure
  const createPeerRef = useRef(createPeer);
  createPeerRef.current = createPeer;

  // ── Cleanup: destroy peers for players who left / disconnected / rejoined ──
  useEffect(() => {
    if (!socket.id) return;
    const activeIds = new Set(
      gameState.players
        .filter(p => p.id !== socket.id && !p.isDisconnected && !p.isAI)
        .map(p => p.id)
    );
    Object.keys(peersRef.current).forEach(peerId => {
      if (!activeIds.has(peerId)) destroyPeer(peerId);
    });
  }, [gameState.players, socket.id]);

  // ── Mesh: ensure a peer connection exists for every active player ──────────
  useEffect(() => {
    if (!socket.id) return;
    gameState.players.forEach(p => {
      if (p.id === socket.id || p.isDisconnected || p.isAI) return;
      createPeerRef.current(p.id);
    });
  }, [gameState.players, socket.id]);

  // ── Signal handler (perfect negotiation) ──────────────────────────────────
  useEffect(() => {
    const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
      const pc = peersRef.current[from] ?? createPeerRef.current(from);
      const meta = peerMetaRef.current[from];
      if (!meta) return;

      try {
        if (signal.sdp) {
          console.log(`[WebRTC] signal sdp type=${signal.sdp.type} from=${from.slice(0,6)} | sigState=${pc.signalingState} makingOffer=${meta.makingOffer} polite=${meta.polite}`);
          const offerCollision =
            signal.sdp.type === 'offer' &&
            (meta.makingOffer || pc.signalingState !== 'stable');

          const ignoreOffer = !meta.polite && offerCollision;
          if (ignoreOffer) { console.log(`[WebRTC] ignoring offer (impolite collision)`); return; }

          if (offerCollision) {
            console.log(`[WebRTC] rollback (polite collision)`);
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          if (signal.sdp.type === 'offer') {
            await pc.setLocalDescription(); // auto-creates answer
            console.log(`[WebRTC] answer sent to from=${from.slice(0,6)}`);
            socket.emit('signal', { to: from, from: socket.id!, signal: { sdp: pc.localDescription } });
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            if (!meta.makingOffer) console.error('ICE error', e);
          }
        }
      } catch (e) {
        console.error('Signal error:', e);
      }
    };

    socket.on('signal', handleSignal);
    return () => { socket.off('signal', handleSignal); };
  }, []);

  // ── Media toggle ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    socket.emit('updateMediaState', { isMicOn: isVoiceActive, isCamOn: isVideoActive });

    if (isVoiceActive || isVideoActive) {
      console.log(`[WebRTC] getUserMedia audio=${isVoiceActive} video=${isVideoActive}`);
      navigator.mediaDevices.getUserMedia({ audio: isVoiceActive, video: isVideoActive })
        .then(stream => {
          const oldStream = localStreamRef.current;
          console.log(`[WebRTC] got stream tracks=${stream.getTracks().map(t => t.kind).join(',')} | hadStream=${!!oldStream} | peers=${Object.keys(peersRef.current).length}`);

          // Sync ref immediately before peer operations
          localStreamRef.current = stream;
          setLocalStream(stream);

          (Object.entries(peersRef.current) as [string, RTCPeerConnection][]).forEach(([peerId, pc]) => {
            stream.getTracks().forEach(track => {
              const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind);
              if (existingSender) {
                // Sender already exists with a live track — just swap to the new track.
                console.log(`[WebRTC] replaceTrack kind=${track.kind} peer=${peerId.slice(0,6)}`);
                existingSender.replaceTrack(track);
                senderKindMap.current.set(existingSender, track.kind);
              } else {
                // No sender for this kind — fresh addTrack fires onnegotiationneeded.
                console.log(`[WebRTC] addTrack kind=${track.kind} peer=${peerId.slice(0,6)}`);
                addTrackToPeer(pc, track, stream);
              }
            });
          });

          // Stop old tracks AFTER new ones are in place
          if (oldStream) oldStream.getTracks().forEach(t => t.stop());
        })
        .catch(err => {
          console.error('Media error:', err);
          setIsVoiceActive(false);
          setIsVideoActive(false);
        });
    } else if (localStream) {
      console.log(`[WebRTC] turning off media — removing our senders, keeping peer connections alive | peers=${Object.keys(peersRef.current).length}`);
      localStream.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      // Only remove OUR senders from each PC — do NOT destroy the peer connection.
      // Destroying the PC would wipe remoteStreams and we'd lose the other player's
      // video feed. By just removing our senders, the inbound tracks (their video)
      // stay intact. On re-enable, addTrackToPeer removes any stale null senders
      // before calling addTrack, so the PC stays clean.
      (Object.values(peersRef.current) as RTCPeerConnection[]).forEach(pc => {
        pc.getSenders().forEach(s => {
          try { pc.removeTrack(s); } catch (e) { }
        });
      });
    }
  }, [isVoiceActive, isVideoActive]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
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
            playSound={playSound}
          />
        </div>
      </main>

      {/* Policy flip animation */}
      <PolicyAnimation gameState={gameState} show={showPolicyAnim} playSound={playSound} />

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
        playSound={playSound}
      />
      <PolicyPeekModal
        policies={peekedPolicies}
        title={peekTitle}
        onClose={() => { setPeekedPolicies(null); setPeekTitle(undefined); }}
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
