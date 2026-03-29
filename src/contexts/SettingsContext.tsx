import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  isMusicOn: boolean;
  setIsMusicOn: (val: boolean) => void;
  isSoundOn: boolean;
  setIsSoundOn: (val: boolean) => void;
  musicVolume: number;
  setMusicVolume: (val: number) => void;
  soundVolume: number;
  setSoundVolume: (val: number) => void;
  ttsVolume: number;
  setTtsVolume: (val: number) => void;
  isFullscreen: boolean;
  setIsFullscreen: (val: boolean) => void;
  ttsVoice: string;
  setTtsVoice: (val: string) => void;
  ttsEngine: string;
  setTtsEngine: (val: string) => void;
  isAiVoiceEnabled: boolean;
  setIsAiVoiceEnabled: (val: boolean) => void;
  uiScaleSetting: number;
  setUiScaleSetting: (val: number) => void;
  isLightMode: boolean;
  setIsLightMode: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem('isMusicOn') !== 'false');
  const [isSoundOn, setIsSoundOn] = useState(() => localStorage.getItem('isSoundOn') !== 'false');
  const [musicVolume, setMusicVolume] = useState(() =>
    parseInt(localStorage.getItem('musicVolume') || '50')
  );
  const [soundVolume, setSoundVolume] = useState(() =>
    parseInt(localStorage.getItem('soundVolume') || '50')
  );
  const [ttsVolume, setTtsVolume] = useState(() =>
    parseInt(localStorage.getItem('ttsVolume') || '50')
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<string>(localStorage.getItem('ttsVoice') || '');
  const [ttsEngine, setTtsEngine] = useState<string>(
    localStorage.getItem('ttsEngine') || 'browser'
  );
  const [isAiVoiceEnabled, setIsAiVoiceEnabled] = useState(
    () => localStorage.getItem('isAiVoiceEnabled') !== 'false'
  );
  const [uiScaleSetting, setUiScaleSetting] = useState(() =>
    parseFloat(localStorage.getItem('uiScaleSetting') || '1')
  );
  const [isLightMode, setIsLightMode] = useState(
    () => localStorage.getItem('isLightMode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('isMusicOn', String(isMusicOn));
    localStorage.setItem('isSoundOn', String(isSoundOn));
    localStorage.setItem('musicVolume', String(musicVolume));
    localStorage.setItem('soundVolume', String(soundVolume));
    localStorage.setItem('ttsVolume', String(ttsVolume));
    localStorage.setItem('ttsVoice', ttsVoice);
    localStorage.setItem('ttsEngine', ttsEngine);
    localStorage.setItem('isAiVoiceEnabled', String(isAiVoiceEnabled));
    localStorage.setItem('uiScaleSetting', String(uiScaleSetting));
    localStorage.setItem('isLightMode', String(isLightMode));
  }, [
    isMusicOn,
    isSoundOn,
    musicVolume,
    soundVolume,
    ttsVolume,
    ttsVoice,
    ttsEngine,
    isAiVoiceEnabled,
    uiScaleSetting,
    isLightMode,
  ]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  return (
    <SettingsContext.Provider
      value={{
        isMusicOn,
        setIsMusicOn,
        isSoundOn,
        setIsSoundOn,
        musicVolume,
        setMusicVolume,
        soundVolume,
        setSoundVolume,
        ttsVolume,
        setTtsVolume,
        isFullscreen,
        setIsFullscreen,
        ttsVoice,
        setTtsVoice,
        ttsEngine,
        setTtsEngine,
        isAiVoiceEnabled,
        setIsAiVoiceEnabled,
        uiScaleSetting,
        setUiScaleSetting,
        isLightMode,
        setIsLightMode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
