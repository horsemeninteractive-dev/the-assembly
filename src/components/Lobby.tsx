import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, MessageSquare, LogOut, User as UserIcon, Trophy, Coins, Settings, Zap, BookOpen, Bell, SlidersHorizontal, Shuffle, Lock, Users2, Globe } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { User, RoomInfo, RoomPrivacy } from '../types';
import { cn, getProxiedUrl } from '../lib/utils';
import { getFrameStyles } from '../lib/cosmetics';
import { LeaderboardModal } from './game/modals/LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';

interface LobbyProps {
  user: User;
  onJoinRoom: (roomId: string, maxPlayers?: number, actionTimer?: number, mode?: 'Casual' | 'Ranked', isSpectator?: boolean, privacy?: string, inviteCode?: string) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  playSound: (soundKey: string) => void;
  token?: string;
}

import { getBackgroundTexture } from '../lib/cosmetics';

export const Lobby: React.FC<LobbyProps> = ({ user, onJoinRoom, onLogout, onOpenProfile, playSound, token }) => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [rejoinInfo, setRejoinInfo] = useState<{ canRejoin: boolean; roomId?: string; roomName?: string; mode?: string } | null>(null);
  const [globalStats, setGlobalStats] = useState<{ civilWins: number; stateWins: number }>({ civilWins: 0, stateWins: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [actionTimer, setActionTimer] = useState(60);
  const [mode, setMode] = useState<'Casual' | 'Ranked'>('Ranked');
  const [privacy, setPrivacy] = useState<RoomPrivacy>('public');
  const [isLoading, setIsLoading] = useState(true);
  const [invitePrompt, setInvitePrompt] = useState<{ roomId: string; roomName: string } | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [filterCasual, setFilterCasual] = useState(true);
  const [filterRanked, setFilterRanked] = useState(true);
  const [filterJoinable, setFilterJoinable] = useState(false);
  const [filterInProgress, setFilterInProgress] = useState(true);
  const [sortBy, setSortBy] = useState<'players' | 'newest'>('newest');
  const [quickJoinStatus, setQuickJoinStatus] = useState<'idle' | 'searching' | 'found' | 'none'>('idle');

  const handleQuickJoin = () => {
    playSound('click');
    setQuickJoinStatus('searching');
    // Find joinable rooms (Lobby phase, has open slot)
    const joinable = rooms.filter(r => r.phase === 'Lobby' && r.playerCount < r.maxPlayers);
    if (joinable.length === 0) {
      setQuickJoinStatus('none');
      setTimeout(() => setQuickJoinStatus('idle'), 3000);
      return;
    }
    // Score by ELO proximity (prefer ranked rooms closer to user's ELO)
    const myElo = user.stats?.elo ?? 1000;
    const scored = joinable.map(r => {
      const eloGap = r.averageElo !== undefined ? Math.abs(r.averageElo - myElo) : 500;
      // Prefer ranked if user has played ranked, prefer rooms with more players (less waiting)
      const modePref = r.mode === 'Ranked' ? 0 : 200;
      const fillBonus = (r.playerCount / r.maxPlayers) * 100;
      return { room: r, score: eloGap + modePref - fillBonus };
    });
    scored.sort((a, b) => a.score - b.score);
    const best = scored[0].room;
    setQuickJoinStatus('found');
    setTimeout(() => {
      setQuickJoinStatus('idle');
      onJoinRoom(best.id);
    }, 600);
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      setRooms(data);

      // Check for rejoin info
      const rejoinResponse = await fetch(`/api/rejoin-info?userId=${user.id}`);
      const rejoinData = await rejoinResponse.json();
      setRejoinInfo(rejoinData);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch(`${window.location.origin}/api/global-stats`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data && typeof data.civilWins === 'number') {
        setGlobalStats(data);
      }
    } catch (err) {
      // Only log once to avoid console spam
      if (globalStats.civilWins === 0 && globalStats.stateWins === 0) {
        console.error('Failed to fetch global stats', err);
      }
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchGlobalStats();
    // Fetch pending friend requests on mount
    if (token) {
      fetch('/api/friends/pending', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.pending) setPendingRequestCount(data.pending.length); })
        .catch(() => { });
    }
    const interval = setInterval(() => {
      fetchRooms();
      fetchGlobalStats();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onJoinRoom(newRoomName.trim(), maxPlayers, actionTimer, mode, false, privacy);
      setIsCreating(false);
    }
  };

  // Derived filtered + sorted room list
  const visibleRooms = rooms
    .filter(room => {
      if (!filterCasual && room.mode === 'Casual') return false;
      if (!filterRanked && room.mode === 'Ranked') return false;
      if (filterJoinable && room.phase !== 'Lobby') return false;
      if (!filterInProgress && room.phase !== 'Lobby') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'players') return b.playerCount - a.playerCount;
      return 0; // 'newest' — server returns newest first by default
    });

  return (
    <div
      className="flex-1 w-full bg-texture text-primary font-sans flex flex-col"
      style={{
        backgroundImage: `url("${getProxiedUrl(getBackgroundTexture(user.activeBackground))}")`
      }}
    >
      {/* Header */}
      <header className="h-[8vh] sm:h-[10vh] border-b border-subtle bg-surface-glass px-[4vw] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-[1vw] sm:gap-[2vw] min-w-0 flex-1">
          <div className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] bg-elevated rounded-xl flex items-center justify-center border border-white/40 shrink-0 overflow-hidden">
            <img src={getProxiedUrl("https://storage.googleapis.com/secretchancellor/SC.png")} alt="The Assembly Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-responsive-sm sm:text-responsive-xl font-thematic text-primary tracking-wide leading-none truncate">The Assembly</h1>
              <span className="text-[8px] font-mono text-red-500/60 border border-red-900/40 rounded px-1 py-0.5 leading-none shrink-0">v0.9.7</span>
            </div>
            <p className="text-responsive-xs uppercase tracking-widest text-muted font-mono mt-0.5">Assembly Lobby</p>
          </div>
        </div>

        {/* Centered Stats */}
        <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-4 px-4 py-2 bg-elevated border border-subtle rounded-2xl">
          <div className="flex items-center gap-2">
            <Trophy className="w-[1.8vh] h-[1.8vh] text-yellow-500" />
            <span className="text-responsive-xs font-mono text-yellow-500">{user.stats.elo} ELO</span>
          </div>
          <div className="w-px h-4 bg-card" />
          <div className="flex items-center gap-2">
            <Coins className="w-[1.8vh] h-[1.8vh] text-emerald-500" />
            <span className="text-responsive-xs font-mono text-emerald-500">{user.stats.points} PTS</span>
          </div>
          <div className="w-px h-4 bg-card" />
          <div className="flex items-center gap-2">
            <Zap className="w-[1.8vh] h-[1.8vh] text-purple-500" />
            <span className="text-responsive-xs font-mono text-purple-500">{user.cabinetPoints} CP</span>
          </div>
        </div>

        <div className="flex items-center gap-[2vw] sm:gap-[3vw] flex-1 justify-end">
          <Tooltip content="My Profile">
            <button
              onClick={() => {
                playSound('click');
                onOpenProfile();
              }}
              className="flex items-center gap-3 group"
            >
              <div className="text-right hidden sm:block">
                <div className="text-responsive-xs font-medium group-hover:text-red-500 transition-colors">{user.username}</div>
                <div className="text-responsive-xs uppercase tracking-widest text-muted font-mono">View Profile</div>
              </div>
              <div className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center group-hover:border-red-900/50 transition-colors relative">
                {user.avatarUrl ? (
                  <img src={getProxiedUrl(user.avatarUrl)} alt={user.username} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <UserIcon className="w-[2vh] h-[2vh] text-muted" />
                )}
                {user.activeFrame && (
                  <div className={cn("absolute inset-0 rounded-xl pointer-events-none", getFrameStyles(user.activeFrame))} />
                )}
                {pendingRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-deep flex items-center justify-center">
                    <span className="text-[8px] font-bold text-primary leading-none">{pendingRequestCount}</span>
                  </span>
                )}
              </div>
            </button>
          </Tooltip>

          <Tooltip content="Leaderboard">
            <button
              onClick={() => {
                playSound('click');
                setIsLeaderboardOpen(true);
              }}
              className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-yellow-900/50 transition-colors"
            >
              <Trophy className="w-[2vh] h-[2vh] text-yellow-500" />
            </button>
          </Tooltip>

          <Tooltip content="How to Play">
            <button
              onClick={() => {
                playSound('click');
                setIsHowToPlayOpen(true);
              }}
              className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-blue-900/50 transition-colors"
            >
              <BookOpen className="w-[2vh] h-[2vh] text-blue-400" />
            </button>
          </Tooltip>

          <Tooltip content="Logout">
            <button
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
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-[4vw] flex flex-col gap-[4vh]">
        {/* Actions (Header/Text) & Swing Meter */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4">
          <div className="bg-surface border border-subtle rounded-3xl p-[2vh] flex flex-col justify-center text-center lg:text-left">
            <h2 className="text-responsive-2xl sm:text-responsive-3xl font-thematic text-primary tracking-wide">Available Assemblies</h2>
            <p className="text-responsive-xs text-muted mt-1">Join an existing session or convene your own.</p>
          </div>

          {/* Swing Meter */}
          <div className="flex-1 bg-surface border border-subtle rounded-3xl p-[2vh] flex flex-col justify-center">
            <div className="flex items-center justify-between text-responsive-xs font-mono uppercase tracking-widest mb-2">
              <span className="text-blue-500">Civil</span>
              <span className="font-thematic text-responsive-xl">
                <span className="text-blue-500">{globalStats.civilWins}</span>
                <span className="text-primary mx-2">v</span>
                <span className="text-red-500">{globalStats.stateWins}</span>
              </span>
              <span className="text-red-500">State</span>
            </div>
            <div className="w-full h-3 bg-elevated rounded-full overflow-hidden flex">
              <div className="bg-blue-600 h-full" style={{ width: `${(globalStats.civilWins / (globalStats.civilWins + globalStats.stateWins || 1)) * 100}%` }}></div>
              <div className="bg-red-600 h-full" style={{ width: `${(globalStats.stateWins / (globalStats.civilWins + globalStats.stateWins || 1)) * 100}%` }}></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {/* Quick Join */}
          <button
            onClick={handleQuickJoin}
            disabled={quickJoinStatus === 'searching' || quickJoinStatus === 'found'}
            className={cn(
              'flex items-center justify-center gap-2 px-[4vw] py-[1.5vh] rounded-2xl font-thematic text-responsive-xl transition-all shadow-xl border',
              quickJoinStatus === 'none'
                ? 'bg-red-900/20 border-red-900/50 text-red-400 cursor-default'
                : quickJoinStatus === 'found'
                  ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-400 cursor-default'
                  : quickJoinStatus === 'searching'
                    ? 'bg-card border-subtle text-muted cursor-default'
                    : 'bg-card border-subtle text-primary hover:border-default hover:bg-hover'
            )}
          >
            <Shuffle className={cn('w-[2vh] h-[2vh]', quickJoinStatus === 'searching' && 'animate-spin')} />
            {quickJoinStatus === 'searching' ? 'Searching…'
              : quickJoinStatus === 'found' ? 'Joining!'
                : quickJoinStatus === 'none' ? 'No Rooms'
                  : 'Quick Join'}
          </button>

          {/* Start New Assembly */}
          <button
            onClick={() => { playSound('click'); setIsCreating(true); }}
            className="flex-1 flex items-center justify-center gap-2 btn-primary px-[4vw] py-[1.5vh] rounded-2xl font-thematic text-responsive-xl hover:bg-subtle transition-all shadow-xl shadow-white/5"
          >
            <Plus className="w-[2vh] h-[2vh]" />
            Start New Assembly
          </button>
        </div>

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
                  <h3 className="text-responsive-sm font-serif italic text-primary">Active Assembly Found</h3>
                  <p className="text-responsive-xs text-red-500/70 font-mono uppercase tracking-widest">You disconnected from: {rejoinInfo.roomName}</p>
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

        {/* Filter & Sort Bar */}
        <div className="flex flex-col gap-1.5">
          {/* Row 1: filters */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-muted shrink-0" />

            {/* Mode filters */}
            {([
              { label: 'Casual', active: filterCasual, toggle: () => setFilterCasual(v => !v), color: 'border-blue-500/60 text-blue-400 bg-blue-900/20' },
              { label: 'Ranked', active: filterRanked, toggle: () => setFilterRanked(v => !v), color: 'border-yellow-500/60 text-yellow-400 bg-yellow-900/20' },
            ] as const).map(f => (
              <button
                key={f.label}
                onClick={() => { playSound('click'); f.toggle(); }}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all shrink-0',
                  f.active ? f.color : 'border-subtle text-ghost bg-elevated'
                )}
              >
                <div className={cn('w-1.5 h-1.5 rounded-sm border', f.active ? 'bg-current border-current' : 'border-ghost')} />
                {f.label}
              </button>
            ))}

            <div className="w-px h-3 bg-subtle shrink-0" />

            {/* Phase filters */}
            {([
              { label: 'Joinable', active: filterJoinable, toggle: () => { setFilterJoinable(v => !v); if (!filterJoinable) setFilterInProgress(false); }, color: 'border-emerald-500/60 text-emerald-400 bg-emerald-900/20' },
              { label: 'Active', active: filterInProgress, toggle: () => { setFilterInProgress(v => !v); if (!filterInProgress) setFilterJoinable(false); }, color: 'border-red-500/60 text-red-400 bg-red-900/20' },
            ] as const).map(f => (
              <button
                key={f.label}
                onClick={() => { playSound('click'); f.toggle(); }}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all shrink-0',
                  f.active ? f.color : 'border-subtle text-ghost bg-elevated'
                )}
              >
                <div className={cn('w-1.5 h-1.5 rounded-sm border', f.active ? 'bg-current border-current' : 'border-ghost')} />
                {f.label}
              </button>
            ))}

            {/* Sort + count pushed to the right */}
            <div className="flex-1" />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] font-mono text-muted uppercase tracking-widest hidden sm:block">Sort</span>
              {([
                { label: 'New', value: 'newest' as const },
                { label: 'Full', value: 'players' as const },
              ]).map(s => (
                <button
                  key={s.value}
                  onClick={() => { playSound('click'); setSortBy(s.value); }}
                  className={cn(
                    'px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all',
                    sortBy === s.value ? 'border-subtle bg-card text-primary' : 'border-transparent text-ghost hover:text-muted'
                  )}
                >
                  {s.label}
                </button>
              ))}
              <span className="text-[9px] font-mono text-faint pl-1">
                {visibleRooms.length}/{rooms.length}
              </span>
            </div>
          </div>
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vh]">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[20vh] bg-surface border border-subtle rounded-3xl animate-pulse" />
            ))
          ) : visibleRooms.length === 0 ? (
            <div className="col-span-full py-[10vh] flex flex-col items-center justify-center text-center bg-surface border border-dashed border-subtle rounded-3xl">
              <MessageSquare className="w-[6vh] h-[6vh] text-whisper mb-4" />
              <p className="text-responsive-sm text-muted font-serif italic">
                {rooms.length === 0 ? 'No active rooms found.' : 'No rooms match your filters.'}
              </p>
              {rooms.length === 0 ? (
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-4 text-responsive-xs text-red-500 font-mono uppercase tracking-widest hover:underline"
                >
                  Be the first to create one
                </button>
              ) : (
                <button
                  onClick={() => { setFilterCasual(true); setFilterRanked(true); setFilterJoinable(false); setFilterInProgress(true); }}
                  className="mt-4 text-responsive-xs text-red-500 font-mono uppercase tracking-widest hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            visibleRooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => {
                  playSound('click');
                  if (room.privacy === 'private') {
                    setInvitePrompt({ roomId: room.id, roomName: room.name });
                  } else {
                    onJoinRoom(room.id);
                  }
                }}
                className="group relative bg-surface border border-subtle rounded-3xl p-[2vh] text-left transition-all hover:border-red-900/50 hover:shadow-2xl hover:shadow-red-900/5 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-[2vh]">
                  <div className="w-[6vh] h-[6vh] bg-elevated border border-subtle rounded-2xl flex items-center justify-center group-hover:bg-red-900/10 group-hover:border-red-900/30 transition-colors">
                    <Users className="w-[3vh] h-[3vh] text-ghost group-hover:text-red-500 transition-colors" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-responsive-xs font-mono uppercase tracking-widest border",
                      room.phase === 'Lobby' ? "bg-emerald-900/10 border-emerald-900/30 text-emerald-500" : "bg-red-900/10 border-red-900/30 text-red-500"
                    )}>
                      {room.phase === 'Lobby' ? 'Recruiting' : 'In Progress'}
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border",
                      room.mode === 'Ranked' ? "bg-yellow-900/10 border-yellow-900/30 text-yellow-500" : "bg-blue-900/10 border-blue-900/30 text-blue-400"
                    )}>
                      {room.mode}
                    </div>
                    {room.privacy && room.privacy !== 'public' && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border bg-card border-subtle text-ghost">
                        {room.privacy === 'private' ? <Lock className="w-2.5 h-2.5" /> : <Users2 className="w-2.5 h-2.5" />}
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

                <h3 className="text-responsive-sm font-serif italic mb-1 group-hover:text-white transition-colors">{room.name}</h3>

                {/* Player Avatars */}
                <div className="flex -space-x-2 mb-[2vh] overflow-hidden">
                  {room.playerAvatars.slice(0, 5).map((avatar, idx) => (
                    <div key={idx} className="w-[3vh] h-[3vh] rounded-full border border-deep bg-card overflow-hidden">
                      <img src={getProxiedUrl(avatar)} alt="Player" className="w-full h-full object-cover" />
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
                    {room.isLocked && room.phase === 'Lobby'
                      ? <><Lock className="w-3 h-3 inline mr-1" />Locked</>
                      : room.privacy === 'private'
                        ? <><Lock className="w-3 h-3 inline mr-1" />Join</>
                        : 'Join'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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

        {isLeaderboardOpen && (
          <LeaderboardModal user={user} onClose={() => setIsLeaderboardOpen(false)} />
        )}
        <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} />
      </main>

      {/* Invite Code Prompt Modal */}
      <AnimatePresence>
        {invitePrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setInvitePrompt(null); setInviteCodeInput(''); }}
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
                  <h3 className="text-lg font-thematic text-primary uppercase tracking-wide">Private Room</h3>
                  <p className="text-xs text-muted font-mono mt-1">{invitePrompt.roomName}</p>
                  <p className="text-xs text-faint mt-1">Enter the invite code to join.</p>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && inviteCodeInput.length === 4) {
                      onJoinRoom(invitePrompt.roomId, undefined, undefined, undefined, false, undefined, inviteCodeInput);
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
                    onClick={() => { setInvitePrompt(null); setInviteCodeInput(''); }}
                    className="flex-1 py-2 border border-subtle text-muted text-xs font-mono uppercase tracking-widest rounded-xl hover:bg-card transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={inviteCodeInput.length !== 4}
                    onClick={() => {
                      onJoinRoom(invitePrompt.roomId, undefined, undefined, undefined, false, undefined, inviteCodeInput);
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

      {/* Create Room Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-backdrop backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-subtle rounded-3xl p-[4vh] shadow-2xl"
            >
              <h2 className="text-responsive-xl font-serif italic mb-[3vh]">Establish New Assembly</h2>
              <form onSubmit={handleCreateRoom} className="space-y-[2vh]">
                <div className="space-y-2">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">Room Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-elevated border border-subtle rounded-xl py-[1.2vh] px-4 text-responsive-sm text-primary focus:outline-none focus:border-red-900/50 transition-colors"
                    placeholder="e.g. Berlin 1933"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">Max Players</label>
                    <span className="text-responsive-sm font-mono text-red-500">{maxPlayers}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="10"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-card rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-[8px] text-ghost font-mono uppercase tracking-tighter">
                    <span>5 Players</span>
                    <span>10 Players</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">Action Timer</label>
                    <span className="text-responsive-sm font-mono text-red-500">{actionTimer === 0 ? 'OFF' : `${actionTimer}s`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="15"
                    value={actionTimer}
                    onChange={(e) => setActionTimer(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-card rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-[8px] text-ghost font-mono uppercase tracking-tighter">
                    <span>OFF</span>
                    <span>120s</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">Game Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('Ranked')}
                      className={cn(
                        "flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all",
                        mode === 'Ranked' ? "bg-yellow-900/20 border-yellow-500 text-yellow-500" : "bg-elevated border-subtle text-ghost"
                      )}
                    >
                      Ranked
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('Casual')}
                      className={cn(
                        "flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all",
                        mode === 'Casual' ? "bg-blue-900/20 border-blue-500 text-blue-400" : "bg-elevated border-subtle text-ghost"
                      )}
                    >
                      Casual
                    </button>
                  </div>
                  <p className="text-[8px] text-ghost italic ml-1">
                    {mode === 'Ranked' ? 'ELO and full points awarded.' : 'No ELO changes, reduced points.'}
                  </p>
                </div>

                {/* Privacy */}
                <div className="space-y-2">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">Privacy</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'public' as const, label: 'Public', icon: <Globe className="w-3.5 h-3.5" />, desc: 'Anyone can join' },
                      { value: 'friends' as const, label: 'Friends Only', icon: <Users2 className="w-3.5 h-3.5" />, desc: 'Your friends only' },
                      { value: 'private' as const, label: 'Private', icon: <Lock className="w-3.5 h-3.5" />, desc: 'Invite code' },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPrivacy(opt.value)}
                        className={cn(
                          'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all',
                          privacy === opt.value
                            ? 'border-red-500/50 bg-red-900/10 text-red-400'
                            : 'border-subtle bg-elevated text-ghost hover:border-default hover:text-muted'
                        )}
                      >
                        {opt.icon}
                        <span className="text-[9px] font-mono uppercase tracking-widest leading-none">{opt.label}</span>
                        <span className="text-[8px] text-faint leading-none">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                  {privacy === 'private' && (
                    <p className="text-[9px] text-faint font-mono ml-1 italic">An invite code will be generated when the room is created.</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setIsCreating(false);
                    }}
                    className="flex-1 py-[1.2vh] border border-subtle text-responsive-xs text-muted font-serif italic rounded-xl hover:bg-card transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-[1.2vh] btn-primary text-responsive-xs font-serif italic rounded-xl hover:bg-subtle transition-colors"
                  >
                    Create Room
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
