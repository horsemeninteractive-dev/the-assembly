import React, { createContext, useContext } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useAuthContext } from './AuthContext';
import { useSettings } from './SettingsContext';

interface AudioContextType {
  playSound: (soundKey: string) => void;
  playMusic: (musicKey: string) => void;
  stopMusic: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInteracted } = useAuthContext();
  const settings = useSettings();
  const audio = useAudioEngine({ user, isInteracted, ...settings });

  return (
    <AudioContext.Provider value={audio}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};


