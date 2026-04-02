import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player } from '../../../shared/types';
import { debugLog, debugWarn, debugError, apiUrl } from '../../utils/utils';
import { PeerMeta } from './types';

interface UseWebRTCConnectionProps {
  gameState: GameState;
  me: Player | undefined;
  token: string | null;
  socket: Socket;
}

export function useWebRTCConnection({
  gameState,
  me,
  token,
  socket,
}: UseWebRTCConnectionProps) {
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
  ]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const peerMetaRef = useRef<Record<string, PeerMeta>>({});

  // 1. Fetch ICE Servers
  useEffect(() => {
    if (!token) return;
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
        debugWarn('[WebRTC] Failed to fetch custom ICE servers, falling back');
      }
    };
    fetchIce();
  }, [token]);

  // 2. Destroy Peer
  const destroyPeer = useCallback((peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try {
        pc.close();
      } catch (e) { /* ignore */ }
      delete peersRef.current[peerId];
    }
    delete peerMetaRef.current[peerId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  // 3. Create or get meta for a peer
  const getPeerMeta = useCallback((peerId: string) => {
    if (!peerMetaRef.current[peerId]) {
      const myId = me?.id || (socket as any).id!;
      const polite = myId > peerId;
      peerMetaRef.current[peerId] = { makingOffer: false, polite, iceQueue: [] };
    }
    return peerMetaRef.current[peerId];
  }, [me?.id, socket]);

  return {
    iceServers,
    peersRef,
    peerMetaRef,
    remoteStreams,
    setRemoteStreams,
    destroyPeer,
    getPeerMeta,
  };
}


