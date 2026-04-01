import React from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  User as UserIcon,
  Trophy,
  Coins,
  Zap,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { User } from '../../../shared/types';
import { cn, getProxiedUrl } from '../../utils/utils';
import { getFrameStyles, getBackgroundTexture } from '../../utils/cosmetics';
import { getRankTier, getRankLabel } from '../../utils/ranks';
import { CLIENT_VERSION } from '../../sharedConstants';

interface LobbyHeaderProps {
  user: User;
  pendingRequestCount: number;
  onOpenProfile: () => void;
  onOpenPurchase: () => void;
  onOpenLeaderboard: () => void;
  onOpenHowToPlay: () => void;
  onLogout: () => void;
  playSound: (soundKey: string) => void;
}

export const LobbyHeader: React.FC<LobbyHeaderProps> = ({
  user,
  pendingRequestCount,
  onOpenProfile,
  onOpenPurchase,
  onOpenLeaderboard,
  onOpenHowToPlay,
  onLogout,
  playSound,
}) => {
  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="border-b border-subtle bg-surface-glass sticky top-0 z-50 flex flex-col"
    >
      <div className="h-[8vh] sm:h-[10vh] px-[4vw] flex items-center justify-between">
        <div className="flex items-center gap-[1vw] sm:gap-[2vw] min-w-0 flex-1">
          <div className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] bg-elevated rounded-xl flex items-center justify-center border border-white/40 shrink-0 overflow-hidden">
            <img
              src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
              alt="The Assembly Logo"
              className="w-full h-full object-contain p-1"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-responsive-sm sm:text-responsive-xl font-thematic text-primary tracking-wide leading-none truncate">
                The Assembly
              </h1>
              <span className="text-[8px] font-mono text-red-500/60 border border-red-900/40 rounded px-1 py-0.5 leading-none shrink-0">
                {CLIENT_VERSION}
              </span>
            </div>
            <p className="text-responsive-xs uppercase tracking-widest text-muted font-mono mt-0.5">
              Assembly Lobby
            </p>
          </div>

          <div className="ml-2 hidden sm:block">
            <Tooltip content="Leaderboard">
              <button
                onMouseEnter={() => playSound('hover')}
                onClick={() => {
                  playSound('click');
                  onOpenLeaderboard();
                }}
                className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-yellow-900/50 transition-colors"
              >
                <Trophy className="w-[2vh] h-[2vh] text-yellow-500" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Centered Stats (Desktop) */}
        <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-4 px-4 py-2 bg-elevated border border-subtle rounded-2xl">
          <div className="flex items-center gap-2">
            <Coins className="w-[1.8vh] h-[1.8vh] text-emerald-500" />
            <span className="text-responsive-xs font-mono text-emerald-500">
              {user.stats.points} IP
            </span>
          </div>
          <div className="w-px h-4 bg-card" />

          {/* ELO Badge */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-xl border transition-all',
              getRankTier(user.stats.elo).bg,
              getRankTier(user.stats.elo).border
            )}
          >
            <span className="text-responsive-xs">{getRankTier(user.stats.elo).icon}</span>
            <div className="flex flex-col leading-none">
              <span
                className={cn(
                  'text-[8px] font-mono font-bold uppercase tracking-tighter',
                  getRankTier(user.stats.elo).color
                )}
              >
                {getRankLabel(user.stats.elo)}
              </span>
              <span className="text-[10px] font-mono text-primary font-bold">
                {user.stats.elo} ELO
              </span>
            </div>
          </div>

          <div className="w-px h-4 bg-card" />
          <div className="flex items-center gap-2">
            <Zap className="w-[1.8vh] h-[1.8vh] text-purple-500" />
            <span className="text-responsive-xs font-mono text-purple-500">
              {user.cabinetPoints || 0} CP
            </span>
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                onOpenPurchase();
              }}
              className="w-[2.2vh] h-[2.2vh] rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center hover:bg-purple-900/40 hover:border-purple-500/50 transition-all ml-1 group/cp"
            >
              <Plus className="w-[1.4vh] h-[1.4vh] text-purple-400 group-hover/cp:text-purple-300" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-[2vw] sm:gap-[3vw] flex-1 justify-end">
          <Tooltip content="My Profile">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                onOpenProfile();
              }}
              className="flex items-center gap-3 group"
            >
              <div className="text-right hidden sm:block">
                <div className="text-responsive-xs font-medium group-hover:text-red-500 transition-colors">
                  {user.username}
                </div>
                <div className="text-responsive-xs uppercase tracking-widest text-muted font-mono">
                  View Profile
                </div>
              </div>
              <div className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center group-hover:border-red-900/50 transition-colors relative">
                {user.avatarUrl ? (
                  <img
                    src={getProxiedUrl(user.avatarUrl)}
                    alt={user.username}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <UserIcon className="w-[2vh] h-[2vh] text-muted" />
                )}
                {user.activeFrame && (
                  <div
                    className={cn(
                      'absolute inset-0 rounded-xl pointer-events-none',
                      getFrameStyles(user.activeFrame)
                    )}
                  />
                )}
                {pendingRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-deep flex items-center justify-center">
                    <span className="text-[8px] font-bold text-primary leading-none">
                      {pendingRequestCount}
                    </span>
                  </span>
                )}
              </div>
            </button>
          </Tooltip>

          {/* Leaderboard — mobile only (desktop version is in the title group) */}
          <Tooltip content="Leaderboard">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                onOpenLeaderboard();
              }}
              className="sm:hidden w-[4vh] h-[4vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-yellow-900/50 transition-colors"
            >
              <Trophy className="w-[2vh] h-[2vh] text-yellow-500" />
            </button>
          </Tooltip>

          <Tooltip content="How to Play">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                onOpenHowToPlay();
              }}
              className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-blue-900/50 transition-colors"
            >
              <BookOpen className="w-[2vh] h-[2vh] text-blue-400" />
            </button>
          </Tooltip>

          <Tooltip content="Logout">
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                onLogout();
              }}
              className="p-[1vh] sm:p-[1.2vh] text-ghost hover:text-red-500 transition-colors bg-elevated border border-subtle rounded-xl"
            >
              <LogOut className="w-[2vh] h-[2vh]" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Mobile Stats Row (Visible only on mobile) */}
      <div className="lg:hidden flex items-center justify-center gap-4 py-2 bg-elevated/20">
        <div className="flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-mono text-emerald-500">{user.stats.points} IP</span>
        </div>
        <div className="w-px h-3 bg-subtle/30" />

        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all',
            getRankTier(user.stats.elo).bg,
            getRankTier(user.stats.elo).border
          )}
        >
          <span className="text-xs">{getRankTier(user.stats.elo).icon}</span>
          <span className="text-[10px] font-mono text-primary font-bold">
            {user.stats.elo} ELO
          </span>
        </div>

        <div className="w-px h-3 bg-subtle/30" />
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-[10px] font-mono text-purple-500">
            {user.cabinetPoints || 0} CP
          </span>
          <button
            onClick={() => {
              playSound('click');
              onOpenPurchase();
            }}
            className="w-4 h-4 rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center hover:bg-purple-900/40 hover:border-purple-500/50 transition-all ml-1"
          >
            <Plus className="w-2.5 h-2.5 text-purple-400" />
          </button>
        </div>
      </div>
    </motion.header>
  );
};


