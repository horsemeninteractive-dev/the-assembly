import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player } from '../types';
import { debugLog, debugWarn, debugError, apiUrl } from '../lib/utils';

interface UseWebRTCProps {
  gameState: GameState;
  me: Player | undefined;
  token: string | null;
  socket: Socket;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  isVideoActive: boolean;
  setIsVideoActive: (active: boolean) => void;
  setSpeakingPlayers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function useWebRTC({
  gameState,
  me,
  token,
  socket,
  isVoiceActive,
  setIsVoiceActive,
  isVideoActive,
  setIsVideoActive,
  setSpeakingPlayers,
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMetaRef = useRef<Record<string, { makingOffer: boolean; polite: boolean }>>({});
  const senderKindMap = useRef(new WeakMap<RTCRtpSender, string>());
  const createPeerRef = useRef<((peerId: string) => RTCPeerConnection) | null>(null);

  const [iceServers, setIceServers] = useState<any[]>([
    { urls: 'stun:stun.l.google.com:19302' },
  ]);

  useEffect(() => {
    const fetchIce = async () => {
      try {
        const res = await fetch(apiUrl('/api/webrtc/ice-servers'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const { iceServers: fetched } = await res.json();
          if (fetched && fetched.length > 0) {
            setIceServers(fetched);
          }
        }
      } catch (err) {
        debugWarn('[WebRTC] Failed to fetch custom ICE servers, falling back to public STUN');
      }
    };
    if (token) fetchIce();
  }, [token]);

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
        const isLocal = me && playerId === me.id;
        const peerExists = !!peersRef.current[playerId];
        if (!isLocal && !peerExists) {
          isRunning = false;
          source.disconnect();
          analyser.disconnect();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        if (sum / bufferLength > 10) {
          setSpeakingPlayers((prev) => ({ ...prev, [playerId]: true }));
          if (speakingTimers.current[playerId]) clearTimeout(speakingTimers.current[playerId]);
          speakingTimers.current[playerId] = setTimeout(() => {
            setSpeakingPlayers((prev) => ({ ...prev, [playerId]: false }));
          }, 400);
        }
        requestAnimationFrame(check);
      };
      check();
    } catch (err) {
      debugError('Voice detection error:', err);
    }
  };

  const destroyPeer = (peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      delete peersRef.current[peerId];
    }
    delete peerMetaRef.current[peerId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const addTrackToPeer = (pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) => {
    pc.getSenders().forEach((s) => {
      const kind = s.track?.kind || senderKindMap.current.get(s);
      if (kind === track.kind) {
        try {
          pc.removeTrack(s);
        } catch (e) {}
      }
    });
    const sender = pc.addTrack(track, stream);
    senderKindMap.current.set(sender, track.kind);
  };

  const createPeer = (peerId: string) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    const polite = socket.id! > peerId;
    peerMetaRef.current[peerId] = { makingOffer: false, polite };

    const pc = new RTCPeerConnection({ iceServers });
    peersRef.current[peerId] = pc;

    setRemoteStreams((prev) => ({ ...prev, [peerId]: new MediaStream() }));

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => addTrackToPeer(pc, track, localStreamRef.current!));
    }
    
    pc.onicecandidate = ({ candidate }) => {
      const target = gameState.players.find((p) => p.id === peerId);
      if (candidate && target?.socketId) {
        socket.emit('signal', { to: target.socketId, from: socket.id!, signal: { candidate } });
      }
    };

    pc.ontrack = ({ track }) => {
      setRemoteStreams((prev) => {
        const existing = prev[peerId] || new MediaStream();
        const otherTracks = existing.getTracks().filter((t) => t.kind !== track.kind);
        const next = new MediaStream([...otherTracks, track]);
        return { ...prev, [peerId]: next };
      });

      track.onended = () => {
        setRemoteStreams((prev) => {
          const st = prev[peerId];
          if (!st) return prev;
          const active = st.getTracks().filter((t) => t !== track);
          if (active.length === 0) {
            const n = { ...prev };
            delete n[peerId];
            return n;
          }
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
      try {
        meta.makingOffer = true;
        await pc.setLocalDescription();
        const target = gameState.players.find((p) => p.id === peerId);
        if (target?.socketId) {
          socket.emit('signal', {
            to: target.socketId,
            from: socket.id!,
            signal: { sdp: pc.localDescription },
          });
        }
      } catch (err) {
        debugError('onnegotiationneeded error', err);
      } finally {
        meta.makingOffer = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        destroyPeer(peerId);
        if (createPeerRef.current) createPeerRef.current(peerId);
      }
    };

    return pc;
  };

  createPeerRef.current = createPeer;

  useEffect(() => {
    if (!socket.id) return;
    const activeIds = new Set(
      gameState.players
        .filter((p) => p.id !== socket.id && p.socketId !== socket.id && !p.isDisconnected && !p.isAI)
        .map((p) => p.id)
    );
    Object.keys(peersRef.current).forEach((peerId) => {
      if (!activeIds.has(peerId)) destroyPeer(peerId);
    });
  }, [gameState.players, socket.id]);

  useEffect(() => {
    if (!socket.id) return;
    gameState.players.forEach((p) => {
      if (p.socketId === socket.id || p.isDisconnected || p.isAI) return;
      if (createPeerRef.current) createPeerRef.current(p.id);
    });
  }, [gameState.players, socket.id]);

  useEffect(() => {
    const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
      const p = gameState.players.find((pl) => pl.socketId === from);
      if (!p) return;
      const peerId = p.id;

      const pc = peersRef.current[peerId] ?? (createPeerRef.current ? createPeerRef.current(peerId) : null);
      if (!pc) return;
      const meta = peerMetaRef.current[peerId];
      if (!meta) return;

      try {
        if (signal.sdp) {
          const offerCollision =
            signal.sdp.type === 'offer' && (meta.makingOffer || pc.signalingState !== 'stable');

          const ignoreOffer = !meta.polite && offerCollision;
          if (ignoreOffer) return;

          if (offerCollision) {
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          if (signal.sdp.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('signal', {
              to: from,
              from: socket.id!,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            if (!meta.makingOffer) debugError('ICE error', e);
          }
        }
      } catch (e) {
        debugError('Signal error:', e);
      }
    };

    socket.on('signal', handleSignal);
    return () => {
      socket.off('signal', handleSignal);
    };
  }, [gameState.players]);

  useEffect(() => {
    if (me && !me.isAlive) {
      setIsVoiceActive(false);
      setIsVideoActive(false);
    }
  }, [me?.isAlive, setIsVoiceActive, setIsVideoActive]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    socket.emit('updateMediaState', { isMicOn: isVoiceActive, isCamOn: isVideoActive });

    if (isVoiceActive || isVideoActive) {
      navigator.mediaDevices
        .getUserMedia({ audio: isVoiceActive, video: isVideoActive })
        .then((stream) => {
          const oldStream = localStreamRef.current;
          localStreamRef.current = stream;
          setLocalStream(stream);

          if (me?.id) setupSpeakingDetection(stream, me.id);

          (Object.entries(peersRef.current) as [string, RTCPeerConnection][]).forEach(
            ([peerId, pc]) => {
              stream.getTracks().forEach((track) => {
                const existingSender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                if (existingSender) {
                  existingSender.replaceTrack(track);
                  senderKindMap.current.set(existingSender, track.kind);
                } else {
                  addTrackToPeer(pc, track, stream);
                }
              });
            }
          );

          if (oldStream) oldStream.getTracks().forEach((t) => t.stop());
        })
        .catch((err) => {
          debugError('Media error:', err);
          setIsVoiceActive(false);
          setIsVideoActive(false);
        });
    } else if (localStream) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = null;
      setLocalStream(null);
      
      (Object.values(peersRef.current) as RTCPeerConnection[]).forEach((pc) => {
        pc.getSenders().forEach((s) => {
          try {
            pc.removeTrack(s);
          } catch (e) {}
        });
      });
    }
  }, [isVoiceActive, isVideoActive, me?.id]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.keys(peersRef.current).forEach(destroyPeer);
    };
  }, []);

  return {
    localStream,
    remoteStreams,
  };
}
