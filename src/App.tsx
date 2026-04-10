import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from './contexts/SettingsContext';
import { useAuthContext } from './contexts/AuthContext';
import { useAudioContext } from './contexts/AudioContext';
import { useGameContext } from './contexts/GameContext';

import { Auth } from './components/Auth';
import { UpdateBanner } from './components/UpdateBanner';
import { InviteModal } from './components/game/modals/InviteModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { EnterSplash } from './components/app/EnterSplash';
import { AppSplash } from './components/app/AppSplash';
import { LandingPage } from './components/app/LandingPage';
import { LobbyView, ProfileModal } from './components/app/LobbyViews';
import { GameRoomView, ModalSection } from './components/app/GameAndModals';

import { getBackgroundTexture } from './utils/cosmetics';
import { cn, getProxiedUrl, apiUrl } from './utils/utils';
import { CLIENT_VERSION } from './sharedConstants';

type UnauthView = 'landing' | 'auth-login' | 'auth-register';

export default function App() {
  const settings = useSettings();
  const {
    user, token, loading, isInteracted, isDiscord, isMobile,
    handleAuthSuccess, handleEnterAssembly
  } = useAuthContext();
  
  const { playSound, playMusic, stopMusic } = useAudioContext();
  
  const {
    joined, gameState, error, pendingInvite, setPendingInvite,
    handleJoinRoom, handleLeaveRoom
  } = useGameContext();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ── Landing / Auth view state ──────────────────────────────────
  const [unauthView, setUnauthView] = useState<UnauthView>(() => {
    // 1. Explicit auth hash (password resets, deep links)
    if (window.location.hash === '#auth') return 'auth-login';
    
    // 2. Returning visitor check
    const hasVisited = localStorage.getItem('assembly_has_visited');
    if (hasVisited) return 'auth-login';

    // 3. First time visitor defaults to landing
    return 'landing';
  });

  // Mark visitor as "having visited" once they've seen the landing page or logged in
  useEffect(() => {
    if (unauthView !== 'landing' || token || user) {
      localStorage.setItem('assembly_has_visited', 'true');
    }
  }, [unauthView, token, user]);

  // Keep URL hash in sync with the current view
  const setViewWithHash = useCallback((view: UnauthView) => {
    if (view === 'landing') {
      window.history.pushState(null, '', window.location.pathname);
    } else {
      window.history.pushState(null, '', '#auth');
    }
    setUnauthView(view);
  }, []);

  // Handle browser Back / Forward
  useEffect(() => {
    const onPop = () => {
      // Only handle unauth navigation
      if (!token && !user) {
        setUnauthView(window.location.hash === '#auth' ? 'auth-login' : 'landing');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [token, user]);

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

  if (loading) return <AppSplash message="Authenticating" />;

  // Show the hero image for the default background (no custom selection)
  const hasCustomBg = user?.activeBackground && user.activeBackground !== 'default';
  const isNebulaVoid = user?.activeBackground === 'bg-nebula-void';
  const showHeroBg = !hasCustomBg && !isNebulaVoid;

  return (
    <div
      className={cn('h-[100dvh] bg-[#07070a] flex flex-col relative overflow-hidden', isDiscord && isMobile && 'pt-12', isNebulaVoid && 'bg-nebula-void')}
      data-theme={settings.isLightMode ? 'light' : 'dark'}
      style={!showHeroBg && !isNebulaVoid ? { backgroundImage: `url("${getProxiedUrl(getBackgroundTexture(user?.activeBackground))}")` } : undefined}
    >
      {/* Hero image default background */}
      {showHeroBg && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img src="/hero.png" alt="" aria-hidden="true" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/20 via-transparent to-red-950/20" />
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none bg-vignette z-[5]" />
      <ErrorBoundary name="Root Application">
        <div className="relative z-10 flex flex-col h-full w-full">
          <UpdateBanner visible={updateAvailable} />
          {error && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9998] px-6 py-3 bg-red-900/90 text-red-100 rounded-2xl text-sm font-mono border border-red-700 shadow-2xl">{error}</div>}
          <AnimatePresence mode="wait">
            {!token || !user ? (
              unauthView === 'landing' ? (
                <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                  <LandingPage
                    onPlayNow={() => setViewWithHash('auth-register')}
                    onLogin={() => setViewWithHash('auth-login')}
                  />
                </motion.div>
              ) : (
                <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                  <Auth
                    onAuthSuccess={handleAuthSuccess}
                    defaultMode={unauthView === 'auth-register' ? 'register' : 'login'}
                  />
                </motion.div>
              )
            ) : !isInteracted ? (
              <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 w-full flex items-center justify-center p-4"><EnterSplash user={user} onEnter={handleEnterAssembly} /></motion.div>
            ) : !joined || !gameState ? (
              <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                <LobbyView setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} />
                <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} />
                {pendingInvite && <InviteModal inviterName={pendingInvite.fromUsername} roomId={pendingInvite.roomId} onAccept={() => { handleJoinRoom(pendingInvite.roomId); setPendingInvite(null); }} onReject={() => setPendingInvite(null)} />}
              </motion.div>
            ) : (
              <motion.div key="gameroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <GameRoomView updateAvailable={updateAvailable} setIsProfileOpen={setIsProfileOpen} />
                <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} setIsProfileOpen={setIsProfileOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} roomId={gameState.roomId} mode={gameState.mode} />
                {pendingInvite && <InviteModal inviterName={pendingInvite.fromUsername} roomId={pendingInvite.roomId} onAccept={() => { handleLeaveRoom(() => handleJoinRoom(pendingInvite.roomId)); setPendingInvite(null); }} onReject={() => setPendingInvite(null)} />}
              </motion.div>
            )}
          </AnimatePresence>
          <ModalSection isPurchaseModalOpen={isPurchaseModalOpen} setIsPurchaseModalOpen={setIsPurchaseModalOpen} />
        </div>
      </ErrorBoundary>
    </div>
  );
}


