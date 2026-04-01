import { useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player } from '../../shared/types';
import { debugError } from '../utils/utils';

// Sub-hooks
import { useWebRTCConnection } from './webrtc/useWebRTCConnection';
import { useWebRTCSignaling } from './webrtc/useWebRTCSignaling';
import { useWebRTCStreams } from './webrtc/useWebRTCStreams';

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
  // 1. Connection & State Management
  const {
    iceServers,
    peersRef,
    peerMetaRef,
    remoteStreams,
    setRemoteStreams,
    destroyPeer,
    getPeerMeta,
  } = useWebRTCConnection({ gameState, me, token, socket });

  // 2. Stream Management (requires peersRef to add tracks)
  const { 
    localStream, 
    localStreamRef, 
    addTrackToPeer, 
    setupSpeakingDetection 
  } = useWebRTCStreams({
    socket,
    me,
    peersRef,
    isVoiceActive,
    isVideoActive,
    setIsVoiceActive,
    setIsVideoActive,
    setSpeakingPlayers,
  });

  // 3. Peer Creation Factory (Used by signaling and player-sync)
  const createPeer = useCallback((peerId: string, knownSocketId?: string) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    const myId = me?.id || socket.id!;
    const meta = getPeerMeta(peerId);

    const pc = new RTCPeerConnection({ iceServers });
    peersRef.current[peerId] = pc;

    setRemoteStreams((prev) => ({ ...prev, [peerId]: new MediaStream() }));

    const getTargetSocketId = () => {
      const target = gameState.players.find((p) => p.id === peerId);
      return target?.socketId || knownSocketId;
    };

    pc.onicecandidate = ({ candidate }) => {
      const targetSocketId = getTargetSocketId();
      if (candidate && targetSocketId) {
        socket.emit('signal', { to: targetSocketId, fromId: myId, signal: { candidate } });
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
      if (!meta) return;
      try {
        meta.makingOffer = true;
        await pc.setLocalDescription();
        const targetSocketId = getTargetSocketId();
        if (targetSocketId) {
          socket.emit('signal', {
            to: targetSocketId,
            fromId: myId,
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
        createPeer(peerId, knownSocketId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => addTrackToPeer(pc, track, localStreamRef.current!));
    }

    return pc;
  }, [
    me?.id, 
    socket, 
    iceServers, 
    peersRef, 
    getPeerMeta, 
    setRemoteStreams, 
    gameState.players, 
    setupSpeakingDetection,
    destroyPeer,
    localStreamRef,
    addTrackToPeer
  ]);

  // 4. Signaling Management
  const { updatePlayers } = useWebRTCSignaling({
    socket,
    me,
    peersRef,
    peerMetaRef,
    createPeer,
  });

  // Sync players list for signaling lookups
  useEffect(() => {
    updatePlayers(gameState.players);
  }, [gameState.players, updatePlayers]);

  // 5. Connection Lifecycle Effects
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
  }, [gameState.players, socket.id, peersRef, destroyPeer]);

  useEffect(() => {
    if (!socket.id) return;
    gameState.players.forEach((p) => {
      if (p.socketId === socket.id || p.isDisconnected || p.isAI) return;
      createPeer(p.id);
    });
  }, [gameState.players, socket.id, createPeer]);

  // Media state enforcement (dead players can't speak)
  useEffect(() => {
    if (me && !me.isAlive) {
      if (isVoiceActive) setIsVoiceActive(false);
      if (isVideoActive) setIsVideoActive(false);
    }
  }, [me?.isAlive, isVoiceActive, isVideoActive, setIsVoiceActive, setIsVideoActive]);

  // Global Cleanup
  useEffect(() => {
    return () => {
      Object.keys(peersRef.current).forEach(destroyPeer);
    };
  }, [peersRef, destroyPeer]);

  return {
    localStream,
    remoteStreams,
  };
}


