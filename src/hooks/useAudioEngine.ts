import { useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { MUSIC_TRACKS, SOUND_PACKS } from '../lib/audio';
import { getProxiedUrl } from '../lib/utils';
import * as aiSpeech from '../services/aiSpeech';
import { socket } from '../socket';

interface UseAudioEngineProps {
  user: User | null;
  isInteracted: boolean;
  isMusicOn: boolean;
  musicVolume: number;
  isSoundOn: boolean;
  soundVolume: number;
  ttsVoice: string;
  ttsVolume: number;
}

export function useAudioEngine({
  user,
  isInteracted,
  isMusicOn,
  musicVolume,
  isSoundOn,
  soundVolume,
  ttsVoice,
  ttsVolume,
}: UseAudioEngineProps) {
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(
    (soundKey: string, overridePack?: string) => {
      if (!isSoundOn) return;
      const pack = overridePack || user?.activeSoundPack || 'default';
      const url = getProxiedUrl(SOUND_PACKS[pack]?.[soundKey] || SOUND_PACKS['default'][soundKey]);
      if (!url) return;
      const audio = new Audio(url);
      audio.volume = soundVolume / 100;
      audio.play().catch(() => {});
    },
    [isSoundOn, soundVolume, user?.activeSoundPack]
  );

  const playMusic = useCallback((trackKey: string) => {
    if (!musicAudioRef.current) return;
    const url = getProxiedUrl(MUSIC_TRACKS[trackKey] || MUSIC_TRACKS['music-ambient']);
    musicAudioRef.current.src = url;
    musicAudioRef.current.play().catch(() => {});
  }, []);

  const stopMusic = useCallback(() => {
    musicAudioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!isMusicOn || !isInteracted) {
      musicAudioRef.current?.pause();
      return;
    }
    const trackKey = user?.activeMusic || 'music-ambient';
    const url = getProxiedUrl(MUSIC_TRACKS[trackKey] || MUSIC_TRACKS['music-ambient']);

    if (!musicAudioRef.current) {
      musicAudioRef.current = new Audio(url);
      musicAudioRef.current.loop = true;
    } else if (musicAudioRef.current.src !== url) {
      musicAudioRef.current.src = url;
    }

    musicAudioRef.current.volume = musicVolume / 100;
    musicAudioRef.current.play().catch(() => {});

    return () => musicAudioRef.current?.pause();
  }, [isMusicOn, isInteracted, user?.activeMusic, musicVolume]);

  useEffect(() => {
    const handlePowerUsed = async (data: { role: string }) => {
      if (!isSoundOn) return;
      const text = `${data.role} power used`;
      aiSpeech.speak(text, { voice: ttsVoice, volume: ttsVolume / 100 });
    };

    socket.on('powerUsed', handlePowerUsed);
    return () => {
      socket.off('powerUsed', handlePowerUsed);
    };
  }, [isSoundOn, ttsVoice, ttsVolume]);

  return { playSound, playMusic, stopMusic };
}
