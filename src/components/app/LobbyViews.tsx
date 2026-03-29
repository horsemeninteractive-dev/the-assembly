import React from 'react';
import { Lobby } from '../Lobby';
import { Profile } from '../Profile';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { User, RoomPrivacy } from '../../types';

export function LobbyView({ user, onJoinRoom, onLogout, setIsProfileOpen, setIsPurchaseModalOpen, playSound, token, uiScale }: { 
  user: User, 
  onJoinRoom: (id: string, max?: number, timer?: number, mode?: any, spec?: boolean, priv?: RoomPrivacy) => void,
  onLogout: () => void,
  setIsProfileOpen: (v: boolean) => void,
  setIsPurchaseModalOpen: (v: boolean) => void,
  playSound: any,
  token: string | null,
  uiScale: number
}) {
  return (
    <ErrorBoundary name="Lobby">
      <Lobby 
        user={user} onJoinRoom={onJoinRoom} onLogout={onLogout} 
        onOpenProfile={() => setIsProfileOpen(true)} 
        onOpenPurchase={() => setIsPurchaseModalOpen(true)} 
        playSound={playSound} token={token || undefined} uiScaleSetting={uiScale} 
      />
    </ErrorBoundary>
  );
}

export function ProfileModal({ isOpen, onClose, user, token, setUser, playSound, playMusic, stopMusic, settings, handleJoinRoom, setIsProfileOpen, setIsPurchaseModalOpen, roomId, mode }: any) {
  if (!isOpen) return null;
  return (
    <ErrorBoundary name="Profile">
      <Profile 
        user={user} token={token!} onClose={onClose} onUpdateUser={setUser}
        playSound={playSound} playMusic={playMusic} stopMusic={stopMusic}
        settings={settings} onOpenPurchase={() => { setIsProfileOpen(false); setIsPurchaseModalOpen(true); }}
        onJoinRoom={(id: string) => { setIsProfileOpen(false); handleJoinRoom(id); }}
        roomId={roomId} mode={mode}
      />
    </ErrorBoundary>
  );
}
