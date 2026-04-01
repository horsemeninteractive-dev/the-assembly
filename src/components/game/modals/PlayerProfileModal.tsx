import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  Trophy,
  User as UserIcon,
  UserPlus,
  UserMinus,
  Shield,
  Check,
  Zap,
  Medal,
} from 'lucide-react';
import { User } from '../../../../shared/types';
import { cn, getProxiedUrl, apiUrl, debugError } from '../../../utils/utils';
import { getFrameStyles } from '../../../utils/cosmetics';
import { socket } from '../../../socket';
import { getLevelFromXp } from '../../../utils/xp';
import { getRankTier, getRankLabel } from '../../../utils/ranks';
import { ACHIEVEMENT_MAP } from '../../../utils/achievements';

interface PlayerProfileModalProps {
  userId: string;
  token: string;
  onClose: () => void;
  playSound: (sound: string) => void;
  onSendFriendRequest: (userId: string) => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  userId,
  token,
  onClose,
  playSound,
  onSendFriendRequest,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(apiUrl(`/api/user/${userId}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.user) {
            setUser(data.user);
            setIsFriend(!!data.isFriend);
          }
        }
      } catch (err) {
        debugError('Failed to fetch user', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();

    socket.on('friendRequestAccepted', (data: { fromUserId: string }) => {
      if (data.fromUserId === userId) {
        setIsFriend(true);
        setIsPending(false);
      }
    });

    return () => {
      socket.off('friendRequestAccepted');
    };
  }, [userId, token]);

  const toggleFriend = async () => {
    playSound('click');
    try {
      if (isFriend) {
        await fetch(apiUrl(`/api/friends/${userId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFriend(false);
      } else {
        onSendFriendRequest(userId);
        setIsPending(true);
      }
    } catch (err) {
      debugError('Failed to toggle friend', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-backdrop-sm backdrop-blur-sm">
        <div className="text-primary font-mono">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-backdrop-sm backdrop-blur-sm">
        <div className="text-primary font-mono">Failed to load profile.</div>
        <button onClick={onClose} className="ml-4 text-primary underline">
          Close
        </button>
      </div>
    );
  }

  const winRate =
    user.stats.gamesPlayed > 0 ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) : 0;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-backdrop-heavy backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-surface border border-subtle rounded-3xl overflow-hidden shadow-2xl text-primary"
      >
        {/* Header - Matching Profile.tsx */}
        <div className="p-[3vh] bg-elevated border-b border-subtle flex flex-col items-center gap-[2vh]">
          <button
            onClick={onClose}
            className="absolute top-[3vh] right-[3vh] text-ghost hover:text-white transition-colors"
          >
            <X className="w-[3vh] h-[3vh]" />
          </button>

          <div className="relative">
            <div className="w-[10vh] h-[10vh] rounded-3xl bg-card border border-default flex items-center justify-center overflow-hidden relative">
              {user.avatarUrl ? (
                <img
                  src={getProxiedUrl(user.avatarUrl)}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-[5vh] h-[5vh] text-ghost" />
              )}
              {user.activeFrame && (
                <div
                  className={cn(
                    'absolute inset-0 border-4 rounded-3xl pointer-events-none',
                    getFrameStyles(user.activeFrame)
                  )}
                />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-red-900 border border-red-500 text-white text-[8px] font-mono px-2 py-0.5 rounded-xl shadow-lg">
              LVL {getLevelFromXp(user.stats.xp)}
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-responsive-xl font-thematic text-primary tracking-wide mb-2">
              {user.username}
            </h2>
            <div className="flex justify-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-xl border',
                  getRankTier(user.stats.elo).bg,
                  getRankTier(user.stats.elo).border
                )}
              >
                <span className="text-sm leading-none">{getRankTier(user.stats.elo).icon}</span>
                <span
                  className={cn(
                    'text-responsive-xs font-mono font-bold',
                    getRankTier(user.stats.elo).color
                  )}
                >
                  {getRankLabel(user.stats.elo)}
                </span>
                <span className="text-responsive-xs font-mono text-faint">· {user.stats.elo}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-[3vh] space-y-[3vh]">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Wins"
              value={user.stats.wins}
              icon={<Trophy className="w-[1.5vh] h-[1.5vh]" />}
            />
            <StatCard
              label="Played"
              value={user.stats.gamesPlayed}
              icon={<Shield className="w-[1.5vh] h-[1.5vh]" />}
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              icon={<Check className="w-[1.5vh] h-[1.5vh]" />}
            />
            <StatCard
              label="Kills"
              icon={<Zap className="w-[1.5vh] h-[1.5vh] text-yellow-500" />}
              value={user.stats.kills}
            />
          </div>

          {/* Pinned achievements — up to 3 slots */}
          {(() => {
            const TIER_COLOURS: Record<string, string> = {
              Bronze: 'text-amber-600  border-amber-700/40  bg-amber-900/20',
              Silver: 'text-slate-300  border-slate-500/40  bg-slate-800/30',
              Gold: 'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
            };
            const pins = (user.pinnedAchievements ?? []).slice(0, 3);
            const slots = [0, 1, 2];
            return (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Medal className="w-[1.5vh] h-[1.5vh] text-yellow-400" />
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted">
                    Pinned Achievements
                  </span>
                </div>
                <div className="space-y-1.5">
                  {slots.map((i) => {
                    const id = pins[i];
                    const def = id ? ACHIEVEMENT_MAP.get(id) : undefined;
                    if (!def) {
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-subtle text-faint text-[10px] font-mono"
                        >
                          — empty slot —
                        </div>
                      );
                    }
                    return (
                      <div
                        key={id}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px]',
                          TIER_COLOURS[def.tier]
                        )}
                      >
                        <span className="font-bold tracking-wide uppercase flex-1">{def.name}</span>
                        <span className="text-[9px] font-mono opacity-60 uppercase tracking-widest shrink-0">
                          {def.tier}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <button
            onClick={toggleFriend}
            disabled={isPending}
            className={cn(
              'w-full py-[1.5vh] rounded-xl font-mono text-responsive-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border',
              isFriend
                ? 'bg-card text-primary border-default hover:bg-subtle'
                : 'bg-red-900 text-white border-red-700 hover:bg-red-800'
            )}
          >
            {isFriend ? (
              <>
                <UserMinus size={14} /> Remove Friend
              </>
            ) : isPending ? (
              'Request Sent'
            ) : (
              <>
                <UserPlus size={14} /> Add Friend
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) => (
  <div className="bg-elevated p-3 rounded-xl border border-subtle flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-ghost">
      {icon}
      <div className="text-[9px] uppercase tracking-wider font-mono">{label}</div>
    </div>
    <div className="text-lg font-serif italic text-primary leading-none">{value}</div>
  </div>
);


