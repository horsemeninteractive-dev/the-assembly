import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, RoomInfo, RoomPrivacy } from '../../shared/types';
import { apiUrl, debugError } from '../utils/utils';
import { LeaderboardModal } from './game/modals/LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';
import { CreditsModal } from './game/modals/CreditsModal';

// Sub-components
import { LobbyHeader } from './lobby/LobbyHeader';
import { LobbyMatchmaking } from './lobby/LobbyMatchmaking';
import { LobbyRoomBrowser } from './lobby/LobbyRoomBrowser';
import { LobbyRoomCreator } from './lobby/LobbyRoomCreator';

interface LobbyProps {
  user: User;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: 'Casual' | 'Ranked' | 'Classic',
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string
  ) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenPurchase: () => void;
  playSound: (soundKey: string) => void;
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
  token,
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
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sound effects for modals
  useEffect(() => {
    if (isCreating || isLeaderboardOpen || isHowToPlayOpen || isCreditsOpen) {
      playSound('modal_open');
    }
  }, [isCreating, isLeaderboardOpen, isHowToPlayOpen, isCreditsOpen]);

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
    <div className="flex-1 w-full text-primary font-sans flex flex-col h-screen overflow-hidden">
      <LobbyHeader
        user={user}
        pendingRequestCount={pendingRequestCount}
        onOpenProfile={onOpenProfile}
        onOpenPurchase={onOpenPurchase}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onLogout={onLogout}
        playSound={playSound}
      />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl w-full mx-auto p-[4vw] flex flex-col gap-[4vh]">
          <LobbyMatchmaking
            user={user}
            rooms={rooms}
            globalStats={globalStats}
            onJoinRoom={onJoinRoom}
            onOpenCreate={() => setIsCreating(true)}
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

          {isLeaderboardOpen && (
            <LeaderboardModal
              user={user}
              onClose={() => {
                playSound('modal_close');
                setIsLeaderboardOpen(false);
              }}
            />
          )}
          <HowToPlayModal
            isOpen={isHowToPlayOpen}
            onClose={() => {
              playSound('modal_close');
              setIsHowToPlayOpen(false);
            }}
          />
        </div>
      </main>

      <footer className="w-full py-6 shrink-0 border-t border-subtle bg-surface-glass backdrop-blur-md sticky bottom-0 z-50 px-[4vw]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-elevated rounded-lg p-1 border border-subtle">
              <img
                src="https://storage.googleapis.com/secretchancellor/HILogo.png"
                alt="Horsemen Interactive"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest leading-none">
                Published by
              </p>
              <p className="text-xs font-serif italic text-primary leading-tight">
                Horsemen Interactive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                setIsCreditsOpen(true);
              }}
              className="text-[10px] font-mono text-red-500/80 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Credits & Legal
            </button>
            <div className="w-px h-3 bg-subtle" />
            <p className="text-[10px] font-mono text-faint uppercase tracking-tighter">
              © 2026 Horsemen Interactive. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isCreditsOpen && (
          <CreditsModal onClose={() => setIsCreditsOpen(false)} playSound={playSound} />
        )}
      </AnimatePresence>

      <LobbyRoomCreator
        user={user}
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onJoinRoom={onJoinRoom}
        playSound={playSound}
      />
    </div>
  );
};


