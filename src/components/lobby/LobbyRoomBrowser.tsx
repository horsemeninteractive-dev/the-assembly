import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  MessageSquare,
  LogOut,
  SlidersHorizontal,
  Lock,
  Users2,
} from 'lucide-react';
import { cn, getProxiedUrl } from '../../lib/utils';
import { RoomInfo, RoomPrivacy } from '../../types';

interface LobbyRoomBrowserProps {
  rooms: RoomInfo[];
  isLoading: boolean;
  rejoinInfo: {
    canRejoin: boolean;
    roomId?: string;
    roomName?: string;
    mode?: string;
  } | null;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: 'Casual' | 'Ranked' | 'Classic',
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string
  ) => void;
  playSound: (soundKey: string) => void;
  onOpenCreate: () => void;
}

export const LobbyRoomBrowser: React.FC<LobbyRoomBrowserProps> = ({
  rooms,
  isLoading,
  rejoinInfo,
  onJoinRoom,
  playSound,
  onOpenCreate,
}) => {
  const [filterCasual, setFilterCasual] = useState(true);
  const [filterRanked, setFilterRanked] = useState(true);
  const [filterClassic, setFilterClassic] = useState(true);
  const [filterJoinable, setFilterJoinable] = useState(false);
  const [filterInProgress, setFilterInProgress] = useState(true);
  const [sortBy, setSortBy] = useState<'players' | 'newest'>('newest');
  const [invitePrompt, setInvitePrompt] = useState<{ roomId: string; roomName: string } | null>(
    null
  );
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const visibleRooms = (Array.isArray(rooms) ? rooms : [])
    .filter((room) => {
      if (!filterCasual && room.mode === 'Casual') return false;
      if (!filterRanked && room.mode === 'Ranked') return false;
      if (!filterClassic && room.mode === 'Classic') return false;
      if (filterJoinable && room.phase !== 'Lobby') return false;
      if (!filterInProgress && room.phase !== 'Lobby') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'players') return b.playerCount - a.playerCount;
      return 0; // Server returns newest first
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Rejoin Banner */}
      <AnimatePresence>
        {rejoinInfo?.canRejoin && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-900/20 border border-red-900/50 rounded-3xl p-[2vh] flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-[6vh] h-[6vh] bg-red-900/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                <LogOut className="w-[3vh] h-[3vh] text-red-500 rotate-180" />
              </div>
              <div>
                <h3 className="text-responsive-sm font-serif italic text-primary">
                  Active Assembly Found
                </h3>
                <p className="text-responsive-xs text-red-500/70 font-mono uppercase tracking-widest">
                  You disconnected from: {rejoinInfo.roomName}
                </p>
              </div>
            </div>
            <button
              onClick={() => onJoinRoom(rejoinInfo.roomId!)}
              className="w-full sm:w-auto bg-red-600 text-white px-[4vw] py-[1.2vh] rounded-xl font-thematic text-responsive-sm hover:bg-red-500 transition-all shadow-lg shadow-red-900/20"
            >
              Rejoin Game
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center flex-wrap gap-1.5 justify-center sm:justify-start">
          <SlidersHorizontal className="w-3 h-3 text-muted shrink-0" />

          {/* Mode filters */}
          {[
            {
              label: 'Casual',
              active: filterCasual,
              toggle: () => setFilterCasual((v) => !v),
              color: 'border-blue-500/60 text-blue-400 bg-blue-900/20',
            },
            {
              label: 'Ranked',
              active: filterRanked,
              toggle: () => setFilterRanked((v) => !v),
              color: 'border-yellow-500/60 text-yellow-400 bg-yellow-900/20',
            },
            {
              label: 'Classic',
              active: filterClassic,
              toggle: () => setFilterClassic((v) => !v),
              color: 'border-emerald-500/60 text-emerald-400 bg-emerald-900/20',
            },
          ].map((f) => (
            <button
              key={f.label}
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                f.toggle();
              }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all shrink-0',
                f.active ? f.color : 'border-subtle text-ghost bg-elevated'
              )}
            >
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-sm border',
                  f.active ? 'bg-current border-current' : 'border-ghost'
                )}
              />
              {f.label}
            </button>
          ))}

          <div className="w-px h-3 bg-subtle shrink-0" />

          {/* Phase filters */}
          {[
            {
              label: 'Joinable',
              active: filterJoinable,
              toggle: () => {
                setFilterJoinable((v) => !v);
                if (!filterJoinable) setFilterInProgress(false);
              },
              color: 'border-emerald-500/60 text-emerald-400 bg-emerald-900/20',
            },
            {
              label: 'Active',
              active: filterInProgress,
              toggle: () => {
                setFilterInProgress((v) => !v);
                if (!filterInProgress) setFilterJoinable(false);
              },
              color: 'border-red-500/60 text-red-400 bg-red-900/20',
            },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => {
                playSound('click');
                f.toggle();
              }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all shrink-0',
                f.active ? f.color : 'border-subtle text-ghost bg-elevated'
              )}
            >
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-sm border',
                  f.active ? 'bg-current border-current' : 'border-ghost'
                )}
              />
              {f.label}
            </button>
          ))}

          <div className="flex-1 hidden sm:block" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-mono text-muted uppercase tracking-widest hidden sm:block">
              Sort
            </span>
            {[
              { label: 'New', value: 'newest' as const },
              { label: 'Full', value: 'players' as const },
            ].map((s) => (
              <button
                key={s.value}
                onMouseEnter={() => playSound('hover')}
                onClick={() => {
                  playSound('click');
                  setSortBy(s.value);
                }}
                className={cn(
                  'px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all',
                  sortBy === s.value
                    ? 'border-subtle bg-card text-primary'
                    : 'border-transparent text-ghost hover:text-muted'
                )}
              >
                {s.label}
              </button>
            ))}
            <span className="text-[9px] font-mono text-faint pl-1">
              {visibleRooms.length}/{Array.isArray(rooms) ? rooms.length : 0}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vh]">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[20vh] bg-surface border border-subtle rounded-2xl animate-pulse"
            />
          ))
        ) : visibleRooms.length === 0 ? (
          <div className="col-span-full py-[10vh] flex flex-col items-center justify-center text-center bg-surface border border-dashed border-subtle rounded-2xl">
            <MessageSquare className="w-[6vh] h-[6vh] text-whisper mb-4" />
            <p className="text-responsive-sm text-muted font-serif italic">
              {(Array.isArray(rooms) ? rooms.length : 0) === 0
                ? 'No active rooms found.'
                : 'No rooms match your filters.'}
            </p>
            {(Array.isArray(rooms) ? rooms.length : 0) === 0 ? (
              <button
                onClick={onOpenCreate}
                className="mt-4 text-responsive-xs text-red-500 font-mono uppercase tracking-widest hover:underline"
              >
                Be the first to create one
              </button>
            ) : (
              <button
                onClick={() => {
                  setFilterCasual(true);
                  setFilterRanked(true);
                  setFilterClassic(true);
                  setFilterJoinable(false);
                  setFilterInProgress(true);
                }}
                className="mt-4 text-responsive-xs text-red-500 font-mono uppercase tracking-widest hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          visibleRooms.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4 + idx * 0.05, duration: 0.3, ease: 'easeOut' }}
              onMouseEnter={() => playSound('hover')}
              onClick={() => {
                playSound('click');
                if (room.privacy === 'private') {
                  setInvitePrompt({ roomId: room.id, roomName: room.name });
                } else {
                  onJoinRoom(room.id);
                }
              }}
              className="group relative bg-surface border border-subtle rounded-2xl p-[2vh] text-left transition-all hover:border-red-900/50 hover:shadow-2xl hover:shadow-red-900/5 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-[2vh]">
                <div className="w-[6vh] h-[6vh] bg-elevated border border-subtle rounded-2xl flex items-center justify-center group-hover:bg-red-900/10 group-hover:border-red-900/30 transition-colors">
                  <Users className="w-[3vh] h-[3vh] text-ghost group-hover:text-red-500 transition-colors" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div
                    className={cn(
                      'px-3 py-1 rounded-full text-responsive-xs font-mono uppercase tracking-widest border',
                      room.phase === 'Lobby'
                        ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-500'
                        : 'bg-red-900/10 border-red-900/30 text-red-500'
                    )}
                  >
                    {room.phase === 'Lobby' ? 'Recruiting' : 'In Progress'}
                  </div>
                  <div
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border',
                      room.mode === 'Ranked'
                        ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-500'
                        : room.mode === 'Classic'
                          ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-500'
                          : 'bg-blue-900/10 border-blue-900/30 text-blue-400'
                    )}
                  >
                    {room.mode}
                  </div>
                  {room.privacy && room.privacy !== 'public' && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border bg-card border-subtle text-ghost">
                      {room.privacy === 'private' ? (
                        <Lock className="w-2.5 h-2.5" />
                      ) : (
                        <Users2 className="w-2.5 h-2.5" />
                      )}
                      {room.privacy === 'private' ? 'Private' : 'Friends'}
                    </div>
                  )}
                  {room.isLocked && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border bg-red-900/20 border-red-900/40 text-red-400">
                      <Lock className="w-2.5 h-2.5" />
                      Locked
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-responsive-sm font-serif italic mb-1 group-hover:text-white transition-colors">
                {room.name}
              </h3>

              <div className="flex -space-x-2 mb-[2vh] overflow-hidden">
                {room.playerAvatars.slice(0, 5).map((avatar, idx) => (
                  <div
                    key={idx}
                    className="w-[3vh] h-[3vh] rounded-full border border-deep bg-card overflow-hidden"
                  >
                    <img
                      src={getProxiedUrl(avatar)}
                      alt="Player"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {room.playerAvatars.length > 5 && (
                  <div className="w-[3vh] h-[3vh] rounded-full border border-deep bg-card flex items-center justify-center text-[8px] font-mono text-muted">
                    +{room.playerAvatars.length - 5}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-muted text-responsive-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <Users className="w-[1.5vh] h-[1.5vh]" />
                  {room.playerCount}/{room.maxPlayers}
                </div>
                <div className="w-1 h-1 bg-subtle rounded-full" />
                <div>{room.phase.replace('_', ' ')}</div>
              </div>

              <div className="mt-[2vh] flex gap-2 transition-opacity">
                <button
                  disabled={!!room.isLocked && room.phase === 'Lobby'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (room.isLocked && room.phase === 'Lobby') return;
                    playSound('click');
                    if (room.privacy === 'private') {
                      setInvitePrompt({ roomId: room.id, roomName: room.name });
                    } else {
                      onJoinRoom(room.id);
                    }
                  }}
                  className={cn(
                    'flex-1 py-[1vh] text-responsive-xs font-mono uppercase tracking-widest rounded-lg transition-colors',
                    room.isLocked && room.phase === 'Lobby'
                      ? 'bg-card border border-subtle text-ghost cursor-not-allowed opacity-50'
                      : 'btn-primary hover:bg-subtle'
                  )}
                >
                  {room.isLocked && room.phase === 'Lobby' ? (
                    'Locked'
                  ) : 'Join'}
                </button>
                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click');
                    onJoinRoom(room.id, undefined, undefined, undefined, true);
                  }}
                  className="flex-1 py-[1vh] bg-card text-primary text-responsive-xs font-mono uppercase tracking-widest rounded-lg border border-default hover:bg-subtle transition-colors"
                >
                  Spectate
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Invite Code Prompt Modal */}
      <AnimatePresence>
        {invitePrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setInvitePrompt(null);
                setInviteCodeInput('');
              }}
              className="absolute inset-0 bg-backdrop backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-surface border border-subtle rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-card rounded-2xl flex items-center justify-center border border-default">
                  <Lock className="w-6 h-6 text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-thematic text-primary uppercase tracking-wide">
                    Private Room
                  </h3>
                  <p className="text-xs text-muted font-mono mt-1">{invitePrompt.roomName}</p>
                  <p className="text-xs text-faint mt-1">Enter the 4-character invite code.</p>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteCodeInput.length === 4) {
                      onJoinRoom(
                        invitePrompt.roomId,
                        undefined,
                        undefined,
                        undefined,
                        false,
                        undefined,
                        inviteCodeInput
                      );
                      setInvitePrompt(null);
                      setInviteCodeInput('');
                    }
                  }}
                  placeholder="XXXX"
                  maxLength={4}
                  className="w-32 text-center text-xl font-mono tracking-[0.5em] bg-elevated border border-subtle rounded-xl py-3 text-primary focus:outline-none focus:border-red-500/50 uppercase transition-colors"
                />
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      setInvitePrompt(null);
                      setInviteCodeInput('');
                    }}
                    className="flex-1 py-2 border border-subtle text-muted text-xs font-mono uppercase tracking-widest rounded-xl hover:bg-card transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={inviteCodeInput.length !== 4}
                    onClick={() => {
                      onJoinRoom(
                        invitePrompt.roomId,
                        undefined,
                        undefined,
                        undefined,
                        false,
                        undefined,
                        inviteCodeInput
                      );
                      setInvitePrompt(null);
                      setInviteCodeInput('');
                    }}
                    className={cn(
                      'flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded-xl transition-colors',
                      inviteCodeInput.length === 4
                        ? 'btn-primary hover:bg-subtle'
                        : 'bg-card text-ghost border border-subtle cursor-not-allowed'
                    )}
                  >
                    Join
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
