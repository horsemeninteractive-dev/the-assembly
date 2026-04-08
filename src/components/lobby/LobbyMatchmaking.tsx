import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shuffle, Plus, Bot } from 'lucide-react';
import { LobbyPracticeCreator } from './LobbyPracticeCreator';
import { cn } from '../../utils/utils';
import { User, RoomInfo, GameMode, RoomPrivacy } from '../../../shared/types';

interface LobbyMatchmakingProps {
  user: User;
  rooms: RoomInfo[];
  globalStats: { civilWins: number; stateWins: number };
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
  onOpenCreate: () => void;
  onOpenPractice: () => void;
  playSound: (soundKey: string) => void;
}

export const LobbyMatchmaking: React.FC<LobbyMatchmakingProps> = ({
  user,
  rooms,
  globalStats,
  onJoinRoom,
  onOpenCreate,
  onOpenPractice,
  playSound,
}) => {
  const [quickJoinStatus, setQuickJoinStatus] = useState<'idle' | 'searching' | 'found' | 'none'>(
    'idle'
  );

  const handleQuickJoin = () => {
    playSound('click');
    setQuickJoinStatus('searching');
    playSound('searching');

    const joinable = (Array.isArray(rooms) ? rooms : []).filter(
      (r) => r.phase === 'Lobby' && r.playerCount < r.maxPlayers
    );

    if (joinable.length === 0) {
      setQuickJoinStatus('none');
      setTimeout(() => setQuickJoinStatus('idle'), 3000);
      return;
    }

    const myElo = user.stats?.elo ?? 1000;
    const scored = joinable.map((r) => {
      const eloGap = r.averageElo !== undefined ? Math.abs(r.averageElo - myElo) : 500;
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

  const total = globalStats.civilWins + globalStats.stateWins || 1;
  const civilPct = (globalStats.civilWins / total) * 100;
  const statePct = (globalStats.stateWins / total) * 100;

  return (
    <>
      {/* ── DESKTOP SIDEBAR VIEW (lg+) ─────────────────────────────────── */}
      {/* Rendered inside the sidebar — compact vertical stack with bottom-anchored stats */}
      <div className="hidden lg:flex flex-col gap-3 h-full">

        {/* Quick Join */}
        <button
          onMouseEnter={() => playSound('hover')}
          onClick={handleQuickJoin}
          disabled={quickJoinStatus === 'searching' || quickJoinStatus === 'found'}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
            quickJoinStatus === 'none'
              ? 'bg-red-900/20 border-red-900/50 text-red-100 cursor-default'
              : quickJoinStatus === 'found'
                ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-100 cursor-default'
                : quickJoinStatus === 'searching'
                  ? 'bg-surface-glass border-subtle text-muted cursor-default'
                  : 'bg-surface-glass border-subtle text-primary hover:border-default hover:bg-surface-glass/80 backdrop-blur-xl transition-all'
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-elevated border border-subtle flex items-center justify-center shrink-0">
            <Shuffle className={cn('w-4 h-4', quickJoinStatus === 'searching' && 'animate-spin')} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-thematic leading-none">
              {quickJoinStatus === 'searching'
                ? 'Searching…'
                : quickJoinStatus === 'found'
                  ? 'Joining!'
                  : quickJoinStatus === 'none'
                    ? 'No Rooms'
                    : 'Quick Join'}
            </div>
            <div className="text-[8px] font-mono text-muted mt-0.5 uppercase tracking-wider">Best available room</div>
          </div>
        </button>

        {/* Create Assembly */}
        <button
          onMouseEnter={() => playSound('hover')}
          onClick={() => { playSound('click'); onOpenCreate(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-red-700/50 bg-red-900/40 hover:bg-red-800/50 text-white text-left transition-all backdrop-blur-xl"
        >
          <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-thematic leading-none">Create Assembly</div>
            <div className="text-[8px] font-mono mt-0.5 uppercase tracking-wider opacity-60">Convene your own</div>
          </div>
        </button>

        {/* Solo Practice */}
        <button
          onMouseEnter={() => playSound('hover')}
          onClick={() => { playSound('click'); onOpenPractice(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-subtle bg-surface-glass hover:border-default hover:bg-surface-glass/80 text-primary text-left transition-all backdrop-blur-xl"
        >
          <div className="w-8 h-8 rounded-lg bg-elevated border border-subtle flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-muted" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-thematic leading-none">Solo Practice</div>
            <div className="text-[8px] font-mono text-muted mt-0.5 uppercase tracking-wider">Train vs AI bots</div>
          </div>
        </button>
        
        {/* Fill available space to push stats to the bottom */}
        <div className="flex-1 min-h-4" />

        {/* Global War Meter */}
        <div className="mt-1">
          <p className="text-[8px] font-mono text-ghost uppercase tracking-[0.22em] px-1 mb-2">
            Global War
          </p>
          <div className="bg-surface-glass border border-subtle rounded-xl p-3 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-widest mb-2 font-bold px-0.5">
              <span className="text-blue-500">{civilPct.toFixed(1)}%</span>
              <span className="text-red-500">{statePct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden flex shadow-inner ring-1 ring-white/5">
              <div
                className="bg-gradient-to-r from-blue-700 to-blue-500 h-full rounded-l-full transition-all duration-1000 ease-out"
                style={{ width: `${civilPct}%` }}
              />
              <div
                className="bg-gradient-to-r from-red-600 to-red-400 h-full rounded-r-full transition-all duration-1000 ease-out"
                style={{ width: `${statePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 font-mono text-[8px] tracking-tighter uppercase opacity-60">
              <span className="text-blue-400">Total: {globalStats.civilWins}</span>
              <span className="text-red-400">Total: {globalStats.stateWins}</span>
            </div>
          </div>
        </div>

        {/* Assembly Statistics */}
        <div className="mt-2 border-t border-subtle pt-4 mx-2">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-mono text-ghost uppercase tracking-widest">Assemblies Running</span>
                <span className="text-xs font-mono text-primary font-bold">{rooms.filter(r => !r.isPractice).length}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono text-ghost uppercase tracking-widest">Active Members</span>
                <span className="text-xs font-mono text-emerald-500 font-bold">
                    {rooms.reduce((acc, r) => acc + r.playerCount, 0) + Math.floor(Math.random() * 5) + 3}
                </span>
            </div>
        </div>
      </div>

      <div className="lg:hidden flex flex-col gap-4">

        {/* Action buttons — 3-across on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
          className="grid grid-cols-3 gap-2 w-full sm:flex sm:gap-4"
        >
          {/* Quick Join */}
          <button
            onMouseEnter={() => playSound('hover')}
            onClick={handleQuickJoin}
            disabled={quickJoinStatus === 'searching' || quickJoinStatus === 'found'}
            className={cn(
              'flex flex-col sm:flex-row flex-1 items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-[4vw] sm:py-[2vh] rounded-xl font-thematic text-[11px] sm:text-responsive-xl transition-all shadow-xl border',
              quickJoinStatus === 'none'
                ? 'bg-red-900/20 border-red-900/50 text-red-100 cursor-default'
                : quickJoinStatus === 'found'
                  ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-100 cursor-default'
                  : quickJoinStatus === 'searching'
                    ? 'bg-surface-glass border-subtle text-muted cursor-default'
                    : 'bg-surface-glass border-subtle text-primary hover:border-default hover:bg-surface-glass/80 backdrop-blur-xl transition-all'
            )}
          >
            <Shuffle className={cn('w-4 h-4 sm:w-[2.2vh] sm:h-[2.2vh]', quickJoinStatus === 'searching' && 'animate-spin')} />
            <span className="text-center leading-tight">
              {quickJoinStatus === 'searching'
                ? 'Searching…'
                : quickJoinStatus === 'found'
                  ? 'Joining!'
                  : quickJoinStatus === 'none'
                    ? 'No Rooms'
                    : 'Quick Join'}
            </span>
          </button>

          {/* Create Assembly */}
          <button
            onMouseEnter={() => playSound('hover')}
            onClick={() => { playSound('click'); onOpenCreate(); }}
            className="flex flex-col sm:flex-row flex-1 items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-[4vw] sm:py-[2vh] rounded-xl font-thematic text-[11px] sm:text-responsive-xl transition-all shadow-xl bg-red-900/40 hover:bg-red-800/50 text-white border border-red-700/50 backdrop-blur-xl"
          >
            <Plus className="w-4 h-4 sm:w-[2.2vh] sm:h-[2.2vh]" />
            <span className="text-center leading-tight">Create</span>
          </button>

          {/* Solo Practice */}
          <button
            onMouseEnter={() => playSound('hover')}
            onClick={() => { playSound('click'); onOpenPractice(); }}
            className="flex flex-col sm:flex-row flex-1 items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:px-[4vw] sm:py-[2vh] rounded-xl font-thematic text-[11px] sm:text-responsive-xl transition-all shadow-xl bg-surface-glass border border-subtle text-muted hover:text-primary hover:border-default backdrop-blur-xl"
          >
            <Bot className="w-4 h-4 sm:w-[2.2vh] sm:h-[2.2vh]" />
            <span className="text-center leading-tight">Practice</span>
          </button>
        </motion.div>
      </div>

    </>
  );
};
