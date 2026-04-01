import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Player } from '../../../shared/types';
import { debugError } from '../../utils/utils';

interface UseWebRTCStreamsProps {
  socket: Socket;
  me: Player | undefined;
  peersRef: React.MutableRefObject<Record<string, RTCPeerConnection>>;
  isVoiceActive: boolean;
  isVideoActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  setIsVideoActive: (active: boolean) => void;
  setSpeakingPlayers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function useWebRTCStreams({
  socket,
  me,
  peersRef,
  isVoiceActive,
  isVideoActive,
  setIsVoiceActive,
  setIsVideoActive,
  setSpeakingPlayers,
}: UseWebRTCStreamsProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const senderKindMap = useRef(new WeakMap<RTCRtpSender, string>());

  // Sync ref for access in effects
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Speaking Detection Logic
  const setupSpeakingDetection = useCallback(async (stream: MediaStream, playerId: string) => {
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
  }, [me?.id, peersRef, setSpeakingPlayers]);

  const addTrackToPeer = useCallback((pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) => {
    pc.getSenders().forEach((s) => {
      const kind = s.track?.kind || senderKindMap.current.get(s);
      if (kind === track.kind) {
        try {
          pc.removeTrack(s);
        } catch (e) { /* ignore */ }
      }
    });
    const sender = pc.addTrack(track, stream);
    senderKindMap.current.set(sender, track.kind);
  }, []);

  // Main Effect: Capture local media and update peers
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
    } else if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      
      (Object.values(peersRef.current) as RTCPeerConnection[]).forEach((pc) => {
        pc.getSenders().forEach((s) => {
          try {
            pc.removeTrack(s);
          } catch (e) { /* ignore */ }
        });
      });
    }
  }, [isVoiceActive, isVideoActive, me?.id, socket, setIsVoiceActive, setIsVideoActive, peersRef, addTrackToPeer, setupSpeakingDetection]);

  return { localStream, localStreamRef, addTrackToPeer, setupSpeakingDetection };
}


