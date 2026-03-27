import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

export interface VoiceProfile {
  voice?: SpeechSynthesisVoice;
  pitch: number;
  rate: number;
}

const aiProfileMap = new Map<string, VoiceProfile>();

export const initVoices = () => {
  if (Capacitor.isNativePlatform()) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const loadVoices = () => {
    const newVoices = window.speechSynthesis.getVoices();
    if (newVoices.length > 0) {
      voices = newVoices;
      voicesLoaded = true;
      // Clear cache if we just got voices for the first time or more voices
      if (aiProfileMap.size > 0 && voices.length > 1) {
        const profiles = Array.from(aiProfileMap.values());
        const firstVoiceName = profiles[0]?.voice?.name;
        const allSame = profiles.every((p) => p.voice?.name === firstVoiceName);
        if (allSame && voices.length > 1) {
          aiProfileMap.clear();
        }
      }
    }
  };

  loadVoices();
  if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Chrome on Android/Mobile sometimes needs a few tries
  for (let i = 1; i <= 5; i++) {
    setTimeout(loadVoices, i * 500);
  }
};

export const getVoiceProfileForAi = (aiName: string): VoiceProfile | undefined => {
  if (aiProfileMap.has(aiName)) return aiProfileMap.get(aiName);

  // On native platforms, we don't have SpeechSynthesisVoice objects.
  // Generate a pitch/rate profile from the AI name hash and return it.
  // speakAiMessage will use the Capacitor TextToSpeech plugin instead.
  if (Capacitor.isNativePlatform()) {
    let hash = 0;
    for (let i = 0; i < aiName.length; i++) {
      hash = aiName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pitch = 0.5 + (Math.abs(hash % 100) / 100) * 1.0;
    const rate = 0.8 + (Math.abs((hash >> 2) % 100) / 100) * 0.6;
    const profile: VoiceProfile = { pitch, rate };
    aiProfileMap.set(aiName, profile);
    return profile;
  }

  // Try one last time to get voices if empty
  if (voices.length === 0 && typeof window !== 'undefined' && window.speechSynthesis) {
    voices = window.speechSynthesis.getVoices();
  }

  if (voices.length === 0) return undefined;

  // Filter for English voices or current locale
  const lang = navigator.language || 'en-US';
  const langPrefix = lang.split('-')[0];
  let preferredVoices = voices.filter((v) => v.lang.startsWith(langPrefix));

  // If no language match, try to find any English voice
  if (preferredVoices.length === 0) {
    preferredVoices = voices.filter((v) => v.lang.startsWith('en'));
  }

  if (preferredVoices.length === 0) preferredVoices = voices;

  // Use a simple hash of the name to pick a voice and variations
  let hash = 0;
  for (let i = 0; i < aiName.length; i++) {
    hash = aiName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Try to pick a voice not already used by another AI
  const usedVoiceNames = Array.from(aiProfileMap.values())
    .map((p) => p.voice?.name)
    .filter(Boolean);
  let availableVoices = preferredVoices.filter((v) => !usedVoiceNames.includes(v.name));

  // If all preferred voices are used, just use the preferred list
  if (availableVoices.length === 0) availableVoices = preferredVoices;

  const voice = availableVoices[Math.abs(hash) % availableVoices.length];

  // Stable variations based on hash to make the voice sound unique
  // If we have very few voices, we should be more aggressive with pitch/rate
  const isLimitedVoices = voices.length < 3;

  // Pitch: 0.5 (deep) to 1.5 (high) - wider range for limited voices
  const pitchRange = isLimitedVoices ? 1.0 : 0.5;
  const pitchBase = isLimitedVoices ? 0.5 : 0.8;
  const pitch = pitchBase + (Math.abs(hash % 100) / 100) * pitchRange;

  // Rate: 0.8 (slow) to 1.4 (fast)
  const rateRange = isLimitedVoices ? 0.6 : 0.3;
  const rateBase = isLimitedVoices ? 0.8 : 0.9;
  const rate = rateBase + (Math.abs((hash >> 2) % 100) / 100) * rateRange;

  const profile: VoiceProfile = { voice, pitch, rate };
  aiProfileMap.set(aiName, profile);
  return profile;
};

export const speakAiMessage = async (
  text: string,
  aiName: string,
  profile: VoiceProfile,
  onStart: () => void,
  onEnd: () => void
) => {
  if (Capacitor.isNativePlatform()) {
    // Safety timeout: if speech takes longer than 30s, force onEnd to prevent
    // the speaking indicator from sticking indefinitely
    const safetyTimer = setTimeout(() => onEnd(), 30000);
    try {
      onStart();
      await TextToSpeech.speak({
        text,
        lang: 'en-US',
        rate: profile.rate,
        pitch: profile.pitch,
        volume: 1.0,
        category: 'ambient',
      });
    } catch (err) {
      console.error('Native speech error:', err);
    } finally {
      clearTimeout(safetyTimer);
      onEnd();
    }
    return;
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Define SpeechSynthesisUtterance safely to avoid ReferenceError on some Android WebViews
  if (typeof SpeechSynthesisUtterance === 'undefined') {
    console.error('SpeechSynthesisUtterance is not defined in this browser');
    onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  if (profile.voice) utterance.voice = profile.voice;
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;

  utterance.onstart = onStart;
  utterance.onend = onEnd;
  utterance.onerror = (e) => {
    console.error('Speech error:', e);
    onEnd();
  };

  window.speechSynthesis.speak(utterance);
};

export const speak = async (
  text: string,
  options: { voice?: string; volume?: number; rate?: number; pitch?: number } = {}
) => {
  const { voice, volume = 1, rate = 0.9, pitch = 0.8 } = options;

  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.speak({
        text,
        lang: 'en-US',
        rate,
        pitch,
        volume: Math.min(1, volume),
        category: 'ambient',
      });
    } catch (err) {
      console.error('Native speech error:', err);
    }
    return;
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (typeof SpeechSynthesisUtterance === 'undefined') return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  if (voice) {
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((v) => v.name === voice);
    if (v) utterance.voice = v;
  }

  window.speechSynthesis.speak(utterance);
};
