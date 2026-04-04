import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Users2, Lock } from 'lucide-react';
import { cn } from '../../utils/utils';
import { RoomPrivacy, User } from '../../../shared/types';

interface LobbyRoomCreatorProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: 'Casual' | 'Ranked' | 'Classic' | 'Crisis',
    isSpectator?: boolean,
    privacy?: RoomPrivacy
  ) => void;
  playSound: (soundKey: string) => void;
  maintenanceMode?: boolean;
}

export const LobbyRoomCreator: React.FC<LobbyRoomCreatorProps> = ({
  user,
  isOpen,
  onClose,
  onJoinRoom,
  playSound,
  maintenanceMode,
}) => {
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [actionTimer, setActionTimer] = useState(60);
  const [mode, setMode] = useState<'Casual' | 'Ranked' | 'Classic' | 'Crisis'>('Ranked');
  const [privacy, setPrivacy] = useState<RoomPrivacy>('public');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onJoinRoom(newRoomName.trim(), maxPlayers, actionTimer, mode, false, privacy);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              playSound('modal_close');
              onClose();
            }}
            className="absolute inset-0 bg-backdrop backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-surface border border-subtle rounded-3xl p-[4vh] shadow-2xl"
          >
            <h2 className="text-responsive-xl font-serif italic mb-[3vh]">
              Establish New Assembly
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-[2vh]">
              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  Room Name
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl py-[1.2vh] px-4 text-responsive-sm text-primary focus:outline-none focus:border-red-900/50 transition-colors"
                  placeholder="e.g. Berlin 1933"
                  maxLength={40}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">
                    Max Players
                  </label>
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
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">
                    Action Timer
                  </label>
                  <span className="text-responsive-sm font-mono text-red-500">
                    {actionTimer === 0 ? 'OFF' : `${actionTimer}s`}
                  </span>
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
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  Game Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setMode('Ranked');
                    }}
                    className={cn(
                      'flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                      mode === 'Ranked'
                        ? 'bg-yellow-900/20 border-yellow-500 text-yellow-500'
                        : 'bg-elevated border-subtle text-ghost'
                    )}
                  >
                    Ranked
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setMode('Casual');
                    }}
                    className={cn(
                      'flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                      mode === 'Casual'
                        ? 'bg-blue-900/20 border-blue-500 text-blue-400'
                        : 'bg-elevated border-subtle text-ghost'
                    )}
                  >
                    Casual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setMode('Classic');
                    }}
                    className={cn(
                      'flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                      mode === 'Classic'
                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-500'
                        : 'bg-elevated border-subtle text-ghost'
                    )}
                  >
                    Classic
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setMode('Crisis');
                    }}
                    className={cn(
                      'flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                      mode === 'Crisis'
                        ? 'bg-purple-900/20 border-purple-500 text-purple-400'
                        : 'bg-elevated border-subtle text-ghost'
                    )}
                  >
                    Crisis
                  </button>
                </div>
                <p className="text-[8px] text-ghost italic ml-1 pt-1">
                  {mode === 'Ranked'
                    ? 'ELO and full points awarded.'
                    : mode === 'Classic'
                      ? 'Standard roles/rules. No ELO, reduced points.'
                      : mode === 'Crisis'
                        ? 'Round-based Event Cards. High risk, high points.'
                        : 'No ELO changes, reduced points.'}
                </p>
              </div>

              {/* Privacy */}
              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  Privacy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: 'public' as const,
                      label: 'Public',
                      icon: <Globe className="w-3.5 h-3.5" />,
                      desc: 'Anyone can join',
                    },
                    {
                      value: 'friends' as const,
                      label: 'Friends Only',
                      icon: <Users2 className="w-3.5 h-3.5" />,
                      desc: 'Your friends only',
                    },
                    {
                      value: 'private' as const,
                      label: 'Private',
                      icon: <Lock className="w-3.5 h-3.5" />,
                      desc: 'Invite code',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseEnter={() => playSound('hover')}
                      onClick={() => {
                        playSound('click');
                        setPrivacy(opt.value);
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all',
                        privacy === opt.value
                          ? 'border-red-500/50 bg-red-900/10 text-red-400'
                          : 'border-subtle bg-elevated text-ghost hover:border-default hover:text-muted'
                      )}
                    >
                      {opt.icon}
                      <span className="text-[9px] font-mono uppercase tracking-widest leading-none">
                        {opt.label}
                      </span>
                      <span className="text-[8px] text-faint leading-none">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {privacy === 'private' && (
                  <p className="text-[9px] text-faint font-mono ml-1 italic">
                    An invite code will be generated when the room is created.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    onClose();
                  }}
                  className="flex-1 py-[1.2vh] border border-subtle text-responsive-xs text-muted font-serif italic rounded-xl hover:bg-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={maintenanceMode && !user.isAdmin}
                  className={cn(
                    "flex-1 py-[1.2vh] text-responsive-xs font-serif italic rounded-xl transition-colors",
                    maintenanceMode && !user.isAdmin 
                      ? "bg-card text-ghost border border-subtle cursor-not-allowed" 
                      : "btn-primary hover:bg-subtle"
                  )}
                >
                  {maintenanceMode && !user.isAdmin ? 'Maintenance' : 'Create Room'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


