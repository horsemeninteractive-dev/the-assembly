import { Player } from '../../../shared/types';

export interface PeerMeta {
  makingOffer: boolean;
  polite: boolean;
  iceQueue: RTCIceCandidateInit[];
}

export interface SignalingPayload {
  from: string;
  fromId?: string;
  signal: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
}

export interface WebRTCState {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
}


