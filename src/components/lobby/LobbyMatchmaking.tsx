import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shuffle, Plus } from 'lucide-react';
import { cn } from '../../utils/utils';
import { User, RoomInfo } from '../../../shared/types';

interface LobbyMatchmakingProps {
  user: User;
  rooms: RoomInfo[];
  globalStats: { civilWins: number; stateWins: number };
  onJoinRoom: (roomId: string) => void;
  onOpenCreate: () => void;
  playSound: (soundKey: string) => void;
}

export const LobbyMatchmaking: React.FC<LobbyMatchmakingProps> = ({
  user,
  rooms,
  globalStats,
  onJoinRoom,
  onOpenCreate,
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

  return (
    <div className="flex flex-col gap-[4vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col lg:flex-row items-stretch gap-4"
      >
        <div className="bg-surface border border-subtle rounded-2xl p-[2vh] flex flex-col justify-center text-center lg:text-left">
          <h2 className="text-responsive-2xl sm:text-responsive-3xl font-thematic text-primary tracking-wide">
            Available Assemblies
          </h2>
          <p className="text-responsive-xs text-muted mt-1">
            Join an existing session or convene your own.
          </p>
        </div>

        {/* Swing Meter */}
        <div className="flex-1 bg-surface border border-subtle rounded-2xl p-[2vh] flex flex-col justify-center">
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
            <div
              className="bg-blue-600 h-full"
              style={{
                width: `${(globalStats.civilWins / (globalStats.civilWins + globalStats.stateWins || 1)) * 100}%`,
              }}
            ></div>
            <div
              className="bg-red-600 h-full"
              style={{
                width: `${(globalStats.stateWins / (globalStats.civilWins + globalStats.stateWins || 1)) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row gap-4 w-full"
      >
        <button
          onMouseEnter={() => playSound('hover')}
          onClick={handleQuickJoin}
          disabled={quickJoinStatus === 'searching' || quickJoinStatus === 'found'}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-[4vw] py-[2vh] rounded-xl font-thematic text-responsive-xl transition-all shadow-xl border',
            quickJoinStatus === 'none'
              ? 'bg-red-900/20 border-red-900/50 text-red-400 cursor-default'
              : quickJoinStatus === 'found'
                ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-400 cursor-default'
                : quickJoinStatus === 'searching'
                  ? 'bg-card border-subtle text-muted cursor-default'
                  : 'bg-card border-subtle text-primary hover:border-default hover:bg-hover'
          )}
        >
          <Shuffle
            className={cn('w-[2.2vh] h-[2.2vh]', quickJoinStatus === 'searching' && 'animate-spin')}
          />
          {quickJoinStatus === 'searching'
            ? 'Searching…'
            : quickJoinStatus === 'found'
              ? 'Joining!'
              : quickJoinStatus === 'none'
                ? 'No Rooms'
                : 'Quick Join'}
        </button>

        <button
          onMouseEnter={() => playSound('hover')}
          onClick={() => {
            playSound('click');
            onOpenCreate();
          }}
          className="flex-1 flex items-center justify-center gap-2 px-[4vw] py-[2vh] rounded-xl font-thematic text-responsive-xl transition-all shadow-xl bg-red-600 hover:bg-red-500 text-white border border-red-700/50"
        >
          <Plus className="w-[2.2vh] h-[2.2vh]" />
          Create Assembly
        </button>
      </motion.div>
    </div>
  );
};


