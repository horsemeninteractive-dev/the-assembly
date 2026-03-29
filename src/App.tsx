import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from './contexts/SettingsContext';
import { useAuth } from './hooks/useAuth';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useSocketManager } from './hooks/useSocketManager';

import { Auth } from './components/Auth';
import { UpdateBanner } from './components/UpdateBanner';
import { InviteModal } from './components/game/modals/InviteModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { EnterSplash } from './components/app/EnterSplash';
import { LobbyView, ProfileModal } from './components/app/LobbyViews';
import { GameRoomView, ModalSection } from './components/app/GameAndModals';

import { getBackgroundTexture } from './lib/cosmetics';
import { cn, getProxiedUrl, apiUrl } from './lib/utils';
import { CLIENT_VERSION } from './sharedConstants';

export default function App() {
  const settings = useSettings();
  const {
    user, setUser, token, loading, isInteracted, isDiscord, isMobile,
    showTutorial, handleAuthSuccess, handleLogout, handleEnterAssembly, handleTutorialComplete
  } = useAuth();
  const { playSound, playMusic, stopMusic } = useAudioEngine({ user, isInteracted, ...settings });
  const {
    joined, gameState, setGameState, privateInfo, setPrivateInfo, error,
    pendingInvite, setPendingInvite, pendingFriendRequest, setPendingFriendRequest,
    adminBroadcast, setAdminBroadcast, serverRestarting, handleJoinRoom, handleLeaveRoom
  } = useSocketManager({ user, token, setUser, playSound });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/version'));
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== 'dev' && data.version !== CLIENT_VERSION) setUpdateAvailable(true);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="min-h-screen bg-base flex items-center justify-center text-primary font-mono">Loading...</div>;

  return (
    <div
      className={cn('h-[100dvh] bg-base flex flex-col bg-texture relative overflow-hidden', isDiscord && isMobile && 'pt-12', user?.activeBackground === 'bg-nebula-void' && 'bg-nebula-void')}
      data-theme={settings.isLightMode ? 'light' : 'dark'}
      style={{ backgroundImage: user?.activeBackground === 'bg-nebula-void' ? 'none' : `url("${getProxiedUrl(getBackgroundTexture(user?.activeBackground))}")` }}
    >
      <div className="absolute inset-0 pointer-events-none bg-vignette z-[5]" />
      <ErrorBoundary name="Root Application">
        <div className="relative z-10 flex flex-col h-full w-full">
          <UpdateBanner visible={updateAvailable} />
          {error && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9998] px-6 py-3 bg-red-900/90 text-red-100 rounded-2xl text-sm font-mono border border-red-700 shadow-2xl">{error}</div>}
          <AnimatePresence mode="wait">
            {!token || !user ? (
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col"><Auth onAuthSuccess={handleAuthSuccess} /></motion.div>
            ) : !isInteracted ? (
              <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 w-full bg-texture flex items-center justify-center p-4"><EnterSplash user={user} onEnter={handleEnterAssembly} /></motion.div>
            ) : !joined || !gameState ? (
              <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                <LobbyView user={user} onJoinRoom={handleJoinRoom} onLogout={handleLogout} setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} playSound={playSound} token={token} uiScale={settings.uiScaleSetting} />
                <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} token={token} setUser={setUser} playSound={playSound} playMusic={playMusic} stopMusic={stopMusic} settings={settings} handleJoinRoom={handleJoinRoom} setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} />
                {pendingInvite && <InviteModal inviterName={pendingInvite.fromUsername} roomId={pendingInvite.roomId} onAccept={() => { handleJoinRoom(pendingInvite.roomId); setPendingInvite(null); }} onReject={() => setPendingInvite(null)} />}
              </motion.div>
            ) : (
              <motion.div key="gameroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <GameRoomView gameState={gameState} privateInfo={privateInfo} user={user} token={token} handleLeaveRoom={handleLeaveRoom} handleJoinRoom={handleJoinRoom} setUser={setUser} setGameState={setGameState} setPrivateInfo={setPrivateInfo} playSound={playSound} settings={settings} updateAvailable={updateAvailable} setIsProfileOpen={setIsProfileOpen} />
                <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} token={token} setUser={setUser} playSound={playSound} playMusic={playMusic} stopMusic={stopMusic} settings={settings} handleJoinRoom={(id: string) => handleLeaveRoom(() => handleJoinRoom(id))} setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} roomId={gameState.roomId} mode={gameState.mode} />
                {pendingInvite && <InviteModal inviterName={pendingInvite.fromUsername} roomId={pendingInvite.roomId} onAccept={() => { handleLeaveRoom(() => handleJoinRoom(pendingInvite.roomId)); setPendingInvite(null); }} onReject={() => setPendingInvite(null)} />}
              </motion.div>
            )}
          </AnimatePresence>
          <ModalSection isPurchaseModalOpen={isPurchaseModalOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} token={token} playSound={playSound} showTutorial={showTutorial} handleTutorialComplete={handleTutorialComplete} pendingFriendRequest={pendingFriendRequest} setPendingFriendRequest={setPendingFriendRequest} adminBroadcast={adminBroadcast} setAdminBroadcast={setAdminBroadcast} serverRestarting={serverRestarting} />
        </div>
      </ErrorBoundary>
    </div>
  );
}
