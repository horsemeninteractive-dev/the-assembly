import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, RoomInfo, RoomPrivacy, GameMode } from '../../shared/types';
import { apiUrl, debugError } from '../utils/utils';
import { LeaderboardModal } from './game/modals/LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';
import { LegalModal } from './game/modals/LegalModal';
import { CreditsScreen } from './lobby/CreditsScreen';
import { useScaling } from '../hooks/useScaling';

// Sub-components
import { LobbyHeader } from './lobby/LobbyHeader';
import { LobbyMatchmaking } from './lobby/LobbyMatchmaking';
import { LobbyRoomBrowser } from './lobby/LobbyRoomBrowser';
import { LobbyRoomCreator } from './lobby/LobbyRoomCreator';
import { LobbyPracticeCreator } from './lobby/LobbyPracticeCreator';

interface LobbyProps {
  user: User;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: GameMode,
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string,
    avatarUrl?: string,
    isPractice?: boolean,
    aiDifficulty?: 'Casual' | 'Normal' | 'Elite'
  ) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenPurchase: () => void;
  playSound: (soundKey: string) => void;
  playMusic?: (trackKey: string) => void;
  stopMusic?: () => void;
  token?: string;
  uiScaleSetting?: number;
}

export const Lobby: React.FC<LobbyProps> = ({
  user,
  onJoinRoom,
  onLogout,
  onOpenProfile,
  onOpenPurchase,
  playSound,
  playMusic,
  stopMusic,
  token,
  uiScaleSetting = 1,
}) => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [rejoinInfo, setRejoinInfo] = useState<{
    canRejoin: boolean;
    roomId?: string;
    roomName?: string;
    mode?: string;
  } | null>(null);
  const [globalStats, setGlobalStats] = useState<{ civilWins: number; stateWins: number }>({
    civilWins: 0,
    stateWins: 0,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const uiScale = useScaling(containerRef, { multiplier: uiScaleSetting });

  useEffect(() => {
    if (isCreating || isLeaderboardOpen || isHowToPlayOpen || isCreditsOpen || isPracticeOpen || isLegalOpen) {
      playSound('modal_open');
    }
  }, [isCreating, isLeaderboardOpen, isHowToPlayOpen, isCreditsOpen, isPracticeOpen, isLegalOpen]);

  useEffect(() => {
    if (isCreditsOpen && playMusic) {
      playMusic('music-credits');
    } else if (!isCreditsOpen && playMusic) {
      // Return to user's active music or default
      const track = user?.activeMusic || 'music-default';
      playMusic(track);
    }
  }, [isCreditsOpen, playMusic, user?.activeMusic]);

  const fetchRooms = async () => {
    try {
      const response = await fetch(apiUrl('/api/rooms'));
      const data = await response.json();
      setRooms(Array.isArray(data) ? data : []);
      const rejoinResponse = await fetch(apiUrl(`/api/rejoin-info?userId=${user.id}`));
      const rejoinData = await rejoinResponse.json();
      setRejoinInfo(rejoinData);
    } catch (err) {
      debugError('Failed to fetch rooms', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch(apiUrl('/api/global-stats'));
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data && typeof data.civilWins === 'number') {
        setGlobalStats(data);
      }
    } catch (err) {
      if (globalStats.civilWins === 0 && globalStats.stateWins === 0) {
        debugError('Failed to fetch global stats', err);
      }
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchGlobalStats();
    if (token) {
      fetch(apiUrl('/api/friends/pending'), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.pending) setPendingRequestCount(data.pending.length);
        })
        .catch(() => {});
    }
    const interval = setInterval(() => {
      fetchRooms();
      fetchGlobalStats();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 w-full text-primary font-sans h-[100dvh] relative overflow-hidden">
      <div 
        className="absolute top-0 left-0 flex flex-col origin-top-left transition-all duration-300"
        style={{
          transform: `scale(${uiScale})`,
          width: `${100 / uiScale}%`,
          height: `${100 / uiScale}%`,
        }}
      >
        {/* Header — logo, stats, icons all unchanged */}
      <LobbyHeader
        user={user}
        pendingRequestCount={pendingRequestCount}
        onOpenProfile={onOpenProfile}
        onOpenPurchase={onOpenPurchase}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onLogout={onLogout}
        globalStats={globalStats}
        playSound={playSound}
      />

      {/* ── DESKTOP lg+: fixed-height sidebar + scrollable room pane ── */}
      <div className="hidden lg:flex flex-1 min-h-0">

        {/* Left sidebar — actions + war meter + credits */}
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-64 xl:w-72 shrink-0 border-r border-subtle bg-base/85 backdrop-blur-2xl flex flex-col gap-0 overflow-y-auto custom-scrollbar"
        >
          <div className="flex flex-col gap-3 p-4 flex-1">
            <p className="text-[8px] font-mono text-ghost uppercase tracking-[0.22em] px-1 pt-1">
              Actions
            </p>

            <LobbyMatchmaking
              user={user}
              rooms={rooms}
              globalStats={globalStats}
              onJoinRoom={onJoinRoom}
              onOpenCreate={() => setIsCreating(true)}
              onOpenPractice={() => setIsPracticeOpen(true)}
              playSound={playSound}
            />
          </div>

        </motion.aside>

        {/* Right pane — room browser fills height, scrolls internally */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.06, ease: 'easeOut' }}
          className="flex-1 min-w-0 flex flex-col min-h-0"
        >
          <LobbyRoomBrowser
            rooms={rooms}
            isLoading={isLoading}
            rejoinInfo={rejoinInfo}
            onJoinRoom={onJoinRoom}
            playSound={playSound}
            onOpenCreate={() => setIsCreating(true)}
          />
        </motion.div>
      </div>

      {/* ── MOBILE <lg: single scrollable column ── */}
      <main className="lg:hidden flex-1 overflow-y-auto custom-scrollbar">
        <div className="w-full p-4 flex flex-col gap-4">
          <LobbyMatchmaking
            user={user}
            rooms={rooms}
            globalStats={globalStats}
            onJoinRoom={onJoinRoom}
            onOpenCreate={() => setIsCreating(true)}
            onOpenPractice={() => setIsPracticeOpen(true)}
            playSound={playSound}
          />
          <LobbyRoomBrowser
            rooms={rooms}
            isLoading={isLoading}
            rejoinInfo={rejoinInfo}
            onJoinRoom={onJoinRoom}
            playSound={playSound}
            onOpenCreate={() => setIsCreating(true)}
          />
        </div>
      </main>

      {/* Unified Footer — paddings match header (px-5) */}
      <footer className="w-full py-3 lg:py-4 border-t border-subtle bg-surface-glass backdrop-blur-xl px-5 shrink-0 z-20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-elevated rounded-lg p-1 border border-subtle">
              <img
                src="https://storage.googleapis.com/secretchancellor/HILogo.png"
                alt="Horsemen Interactive"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-[9px] font-mono text-muted uppercase tracking-[0.2em] leading-none">Published by</p>
              <p className="text-xs font-serif italic text-primary leading-tight">Horsemen Interactive</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setIsCreditsOpen(true); }}
              className="text-[9px] font-mono text-primary/80 hover:text-white uppercase tracking-widest transition-colors font-bold"
            >
              Credits
            </button>
            <div className="w-px h-3 bg-subtle" />
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setIsLegalOpen(true); }}
              className="text-[9px] font-mono text-muted hover:text-primary uppercase tracking-widest transition-colors"
            >
              Legal Info
            </button>
            <div className="w-px h-3 bg-subtle hidden sm:block" />
            <p className="text-[9px] font-mono text-ghost uppercase tracking-tighter">
              © 2026 Horsemen Interactive
            </p>
          </div>
        </div>
      </footer>
      </div>

      {/* Modals */}
      {isLeaderboardOpen && (
        <LeaderboardModal
          user={user}
          onClose={() => { playSound('modal_close'); setIsLeaderboardOpen(false); }}
        />
      )}
      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => { playSound('modal_close'); setIsHowToPlayOpen(false); }}
      />
      <AnimatePresence>
        {isCreditsOpen && (
          <CreditsScreen user={user} onClose={() => setIsCreditsOpen(false)} playSound={playSound} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isLegalOpen && (
          <LegalModal onClose={() => setIsLegalOpen(false)} playSound={playSound} />
        )}
      </AnimatePresence>
      <LobbyRoomCreator
        user={user}
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onJoinRoom={onJoinRoom}
        playSound={playSound}
      />
      <LobbyPracticeCreator
        user={user}
        isOpen={isPracticeOpen}
        onClose={() => setIsPracticeOpen(false)}
        onJoinRoom={onJoinRoom}
        playSound={playSound}
      />
    </div>
  );
};
