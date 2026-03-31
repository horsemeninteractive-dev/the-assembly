import React from 'react';
import { GameRoom } from '../GameRoom';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { socket } from '../../socket';
import { PurchaseCPModal } from '../PurchaseCPModal';
import { TutorialModal } from '../TutorialModal';
import { FriendRequestModal } from '../game/modals/FriendRequestModal';
import { AnimatePresence, motion } from 'motion/react';
import { Megaphone, X } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useAudioContext } from '../../contexts/AudioContext';
import { useGameContext } from '../../contexts/GameContext';
import { useSettings } from '../../contexts/SettingsContext';

export function GameRoomView({ updateAvailable, setIsProfileOpen }: { updateAvailable: boolean, setIsProfileOpen: (v: boolean) => void }) {
  const { user, token, setUser } = useAuthContext();
  const { playSound } = useAudioContext();
  const { gameState, setGameState, privateInfo, setPrivateInfo, handleLeaveRoom, handleJoinRoom } = useGameContext();
  const settings = useSettings();

  if (!gameState || !user) return null;

  return (
    <ErrorBoundary name="Game Room">
      <GameRoom 
        gameState={gameState} privateInfo={privateInfo} user={user} token={token}
        onLeaveRoom={handleLeaveRoom} onPlayAgain={() => socket.emit('playAgain')}
        onOpenProfile={() => setIsProfileOpen(true)} onJoinRoom={handleJoinRoom}
        setUser={setUser} setGameState={setGameState} setPrivateInfo={setPrivateInfo}
        updateAvailable={updateAvailable} playSound={playSound} soundVolume={settings.soundVolume}
        ttsVolume={settings.ttsVolume} ttsVoice={settings.ttsVoice} ttsEngine={settings.ttsEngine}
        isAiVoiceEnabled={settings.isAiVoiceEnabled} uiScaleSetting={settings.uiScaleSetting}
      />
    </ErrorBoundary>
  );
}

export function ModalSection({ isPurchaseModalOpen, setIsPurchaseModalOpen }: { isPurchaseModalOpen: boolean, setIsPurchaseModalOpen: (v: boolean) => void }) {
  const { token, showTutorial, handleTutorialComplete } = useAuthContext();
  const { playSound } = useAudioContext();
  const { 
    pendingFriendRequest, setPendingFriendRequest, 
    adminBroadcast, setAdminBroadcast, 
    serverRestarting 
  } = useGameContext();

  return (
    <>
      <PurchaseCPModal isOpen={isPurchaseModalOpen} onClose={() => { playSound('modal_close'); setIsPurchaseModalOpen(false); }} token={token || ''} playSound={playSound} />
      <TutorialModal isOpen={showTutorial} onComplete={handleTutorialComplete} onSkip={handleTutorialComplete} />
      {pendingFriendRequest && (
        <FriendRequestModal 
          fromUsername={pendingFriendRequest.fromUsername} 
          onAccept={() => { socket.emit('acceptFriendRequest', pendingFriendRequest.fromUserId); setPendingFriendRequest(null); playSound('notification'); }} 
          onDeny={() => setPendingFriendRequest(null)} 
        />
      )}
      <AnimatePresence>
        {adminBroadcast && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md px-4">
            <div className="bg-yellow-900/90 border-2 border-yellow-500 text-yellow-100 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 shrink-0"><Megaphone className="w-6 h-6 text-yellow-500" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-yellow-500/70">System Announcement</span>
                  <button onClick={() => setAdminBroadcast(null)} className="text-yellow-500/50 hover:text-yellow-500"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-sm font-serif italic mb-2 leading-relaxed">"{adminBroadcast.message}"</p>
                <div className="text-[9px] font-mono text-yellow-500/50 uppercase tracking-widest text-right">— {adminBroadcast.sender}</div>
              </div>
            </div>
          </motion.div>
        )}
        {serverRestarting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[20000] bg-backdrop-heavy backdrop-blur-2xl flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <div className="w-20 h-20 rounded-3xl bg-red-900/20 border border-red-500/30 flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <Megaphone className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-3xl font-thematic text-primary uppercase mb-4">Incoming Update</h2>
              <p className="text-lg text-ghost font-serif italic mb-8 leading-relaxed">"{serverRestarting}"</p>
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-1.5">{[0, 1, 2].map((i) => <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="w-2 h-2 rounded-full bg-red-500" />)}</div>
                <span className="text-[10px] font-mono text-muted uppercase tracking-[0.3em]">Synchronizing...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
