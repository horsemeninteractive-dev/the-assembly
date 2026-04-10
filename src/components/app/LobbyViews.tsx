import React from 'react';
import { Lobby } from '../Lobby';
import { Profile } from '../Profile';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAuthContext } from '../../contexts/AuthContext';
import { useAudioContext } from '../../contexts/AudioContext';
import { useGameContext } from '../../contexts/GameContext';
import { useSettings } from '../../contexts/SettingsContext';

export function LobbyView({ setIsProfileOpen, setIsPurchaseModalOpen }: { 
  setIsProfileOpen: (v: boolean) => void,
  setIsPurchaseModalOpen: (v: boolean) => void
}) {
  const { user, token, handleLogout } = useAuthContext();
  const { playSound, playMusic, stopMusic } = useAudioContext();
  const { handleJoinRoom } = useGameContext();
  const { uiScaleSetting } = useSettings();

  if (!user) return null;

  return (
    <ErrorBoundary name="Lobby">
      <Lobby 
        user={user} onJoinRoom={handleJoinRoom} onLogout={handleLogout} 
        onOpenProfile={() => setIsProfileOpen(true)} 
        onOpenPurchase={() => setIsPurchaseModalOpen(true)} 
        playSound={playSound}
        playMusic={playMusic}
        stopMusic={stopMusic}
        token={token || undefined} 
        uiScaleSetting={uiScaleSetting} 
      />
    </ErrorBoundary>
  );
}

export function ProfileModal({ isOpen, onClose, setIsProfileOpen, setIsPurchaseModalOpen, roomId, mode }: any) {
  const { user, token, setUser } = useAuthContext();
  const { playSound, playMusic, stopMusic } = useAudioContext();
  const { handleJoinRoom, handleLeaveRoom } = useGameContext();
  const settings = useSettings();

  if (!isOpen || !user) return null;

  return (
    <ErrorBoundary name="Profile">
      <Profile 
        user={user} token={token!} onClose={onClose} onUpdateUser={setUser}
        playSound={playSound} playMusic={playMusic} stopMusic={stopMusic}
        settings={settings} onOpenPurchase={() => { setIsProfileOpen(false); setIsPurchaseModalOpen(true); }}
        onJoinRoom={(id: string) => { setIsProfileOpen(false); handleLeaveRoom(() => handleJoinRoom(id)); }}
        roomId={roomId} mode={mode}
      />
    </ErrorBoundary>
  );
}


