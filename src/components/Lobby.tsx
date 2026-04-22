import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, RoomInfo, RoomPrivacy, GameMode } from '../../shared/types';
import { apiUrl, debugError } from '../utils/utils';
import { LeaderboardModal } from './game/modals/LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';
import { LegalModal } from './game/modals/LegalModal';
import { CreditsScreen } from './lobby/CreditsScreen';
import { SeasonalRewardsModal } from './game/modals/SeasonalRewardsModal';
import { useScaling } from '../hooks/useScaling';

// Sub-components
import { LobbyHeader } from './lobby/LobbyHeader';
import { LobbyMatchmaking } from './lobby/LobbyMatchmaking';
import { LobbyRoomBrowser } from './lobby/LobbyRoomBrowser';
import { LobbyRoomCreator } from './lobby/LobbyRoomCreator';
import { LobbyPracticeCreator } from './lobby/LobbyPracticeCreator';
import { ChangelogModal } from './game/modals/ChangelogModal';


import { useTranslation, Trans } from '../contexts/I18nContext';
import { useGameContext } from '../contexts/GameContext';
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
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [rejoinInfo, setRejoinInfo] = useState<{
    canRejoin: boolean;
    roomId?: string;
    roomName?: string;
    mode?: string;
  } | null>(null);
  const { handleJoinRoom, systemConfig, pendingSeasonReward, setPendingSeasonReward } = useGameContext();
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
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const discordLink = systemConfig?.currentSeasonNumber === 0 
    ? 'https://discord.gg/BMMARwZU9' 
    : 'https://discord.gg/Y5z7sm5SkK';

  const [isLoading, setIsLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const uiScale = useScaling(containerRef, { multiplier: uiScaleSetting });

  useEffect(() => {
    if (isCreating || isLeaderboardOpen || isHowToPlayOpen || isCreditsOpen || isPracticeOpen || isLegalOpen || isChangelogOpen) {
      playSound('modal_open');
    }
  }, [isCreating, isLeaderboardOpen, isHowToPlayOpen, isCreditsOpen, isPracticeOpen, isLegalOpen, isChangelogOpen]);


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
        systemConfig={systemConfig}
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
              {t('lobby.sidebar.actions')}
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
              <p className="text-[9px] font-mono text-muted uppercase tracking-[0.2em] leading-none">{t('lobby.footer.published_by')}</p>
              <p className="text-xs font-serif italic text-primary leading-tight">Horsemen Interactive</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setIsChangelogOpen(true); }}
              className="text-[9px] font-mono text-primary/80 hover:text-white uppercase tracking-widest transition-colors font-bold"
            >
              {t('lobby.footer.changelog')}
            </button>
            <div className="w-px h-3 bg-subtle" />
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setIsCreditsOpen(true); }}
              className="text-[9px] font-mono text-primary/80 hover:text-white uppercase tracking-widest transition-colors font-bold"
            >
              {t('lobby.footer.credits')}
            </button>

            <div className="w-px h-3 bg-subtle" />
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setIsLegalOpen(true); }}
              className="text-[9px] font-mono text-muted hover:text-primary uppercase tracking-widest transition-colors"
            >
              {t('lobby.footer.legal')}
            </button>
            <div className="w-px h-3 bg-subtle hidden sm:block" />
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => playSound('hover')}
              onClick={() => playSound('click')}
              className="text-[9px] font-mono text-muted hover:text-[#5865F2] uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Discord
            </a>
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
      <AnimatePresence>
        {pendingSeasonReward && (
          <SeasonalRewardsModal
            reward={pendingSeasonReward}
            onClose={() => setPendingSeasonReward(null)}
          />
        )}
      </AnimatePresence>
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
        discordLink={discordLink}
        playSound={playSound}
      />


    </div>
  );
};
