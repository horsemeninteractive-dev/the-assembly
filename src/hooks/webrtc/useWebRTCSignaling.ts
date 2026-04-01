import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player } from '../../../shared/types';
import { debugLog, debugWarn, debugError } from '../../utils/utils';
import { SignalingPayload, PeerMeta } from '../../../shared/types';

interface UseWebRTCSignalingProps {
  socket: Socket;
  me: Player | undefined;
  peersRef: React.MutableRefObject<Record<string, RTCPeerConnection>>;
  peerMetaRef: React.MutableRefObject<Record<string, PeerMeta>>;
  createPeer: (peerId: string, knownSocketId?: string) => RTCPeerConnection;
}

export function useWebRTCSignaling({
  socket,
  me,
  peersRef,
  peerMetaRef,
  createPeer,
}: UseWebRTCSignalingProps) {
  const playersRef = useRef<Player[]>([]);
  
  // Keep players list fresh for lookup
  const updatePlayers = useCallback((players: Player[]) => {
    playersRef.current = players;
  }, []);

  // Handler for incoming signals
  useEffect(() => {
    const handleSignal = async ({ from, fromId, signal }: SignalingPayload) => {
      let peerId = fromId;
      if (!peerId) {
        const p = playersRef.current.find((pl) => pl.socketId === from);
        if (!p) return;
        peerId = p.id;
      }

      const pc = peersRef.current[peerId] ?? createPeer(peerId, from);
      if (!pc) return;
      const meta = peerMetaRef.current[peerId];
      if (!meta) return;

      try {
        if (signal.sdp) {
          const offerCollision =
            signal.sdp.type === 'offer' && (meta.makingOffer || pc.signalingState !== 'stable');

          const ignoreOffer = !meta.polite && offerCollision;
          if (ignoreOffer) {
            debugLog(`[WebRTC] Ignoring offer from ${peerId} (collision)`);
            return;
          }

          if (offerCollision) {
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          if (signal.sdp.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('signal', {
              to: from,
              fromId: me?.id || socket.id!, 
              signal: { sdp: pc.localDescription },
            });
          }

          if (meta.iceQueue && meta.iceQueue.length > 0) {
            for (const c of meta.iceQueue) {
              pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) => debugError('Queued ICE error', e));
            }
            meta.iceQueue = [];
          }
        } else if (signal.candidate) {
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              meta.iceQueue.push(signal.candidate);
            }
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
  }, [socket, me?.id, createPeer, peersRef, peerMetaRef]);

  return { updatePlayers };
}


