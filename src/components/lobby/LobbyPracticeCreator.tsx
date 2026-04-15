import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot } from 'lucide-react';
import { cn } from '../../utils/utils';
import { User as UserType } from '../../../shared/types';
import { useTranslation } from '../../contexts/I18nContext';

interface LobbyPracticeCreatorProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: 'Casual' | 'Ranked' | 'Classic' | 'Crisis',
    isSpectator?: boolean,
    privacy?: 'public' | 'friends' | 'private',
    inviteCode?: string,
    avatarUrl?: string,
    isPractice?: boolean,
    aiDifficulty?: 'Casual' | 'Normal' | 'Elite'
  ) => void;
  playSound: (soundKey: string) => void;
}

export const LobbyPracticeCreator: React.FC<LobbyPracticeCreatorProps> = ({
  user,
  isOpen,
  onClose,
  onJoinRoom,
  playSound,
}) => {
  const { t } = useTranslation();
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [mode, setMode] = useState<'Casual' | 'Classic' | 'Crisis'>('Casual');
  const [difficulty, setDifficulty] = useState<'Casual' | 'Normal' | 'Elite'>('Normal');

  const handleStartPractice = (e: React.FormEvent) => {
    e.preventDefault();
    const practiceRoomId = `Practice-${user.username}-${Math.floor(Math.random() * 1000)}`;
    onJoinRoom(
      practiceRoomId,
      maxPlayers,
      0,
      mode,
      false,
      'private',
      undefined,
      undefined,
      true,
      difficulty
    );
    onClose();
  };

  const difficultyDesc = (d: 'Casual' | 'Normal' | 'Elite') => {
    if (d === 'Casual') return t('lobby.practice.difficulty_casual_desc');
    if (d === 'Normal') return t('lobby.practice.difficulty_normal_desc');
    return t('lobby.practice.difficulty_elite_desc');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
            className="relative w-full max-w-md bg-surface-glass border border-subtle rounded-3xl p-[4vh] shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-[2vh] mb-[3vh]">
              <div className="w-[8vh] h-[8vh] bg-red-900/10 border border-red-900/30 rounded-2xl flex items-center justify-center">
                <Bot className="w-[4vh] h-[4vh] text-red-500" />
              </div>
              <div>
                <h2 className="text-responsive-xl font-serif italic leading-none">
                  {t('lobby.practice.title')}
                </h2>
                <p className="text-responsive-xs text-muted uppercase tracking-widest font-mono mt-1">
                  {t('lobby.practice.subtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handleStartPractice} className="space-y-[3vh]">
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">
                    {t('lobby.practice.total_players')}
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
                  <span>{t('lobby.practice.players_min')}</span>
                  <span>{t('lobby.practice.players_max')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  {t('lobby.creator.game_mode')}
                </label>
                <div className="flex gap-2">
                  {(['Casual', 'Classic', 'Crisis'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setMode(m);
                      }}
                      className={cn(
                        'flex-1 py-[1.2vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                        mode === m
                          ? m === 'Casual' ? 'bg-blue-900/20 border-blue-500 text-blue-400' :
                            m === 'Classic' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-500' :
                            'bg-purple-900/20 border-purple-500 text-purple-400'
                          : 'bg-elevated border-subtle text-ghost'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  {t('lobby.practice.ai_difficulty')}
                </label>
                <div className="flex gap-2">
                  {(['Casual', 'Normal', 'Elite'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setDifficulty(d);
                      }}
                      className={cn(
                        'flex-1 py-[1.2vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                        difficulty === d
                          ? 'bg-red-900/20 border-red-500 text-red-500'
                          : 'bg-elevated border-subtle text-ghost'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-ghost italic ml-1 pt-1">
                  {difficultyDesc(difficulty)}
                </p>
              </div>

              <div className="pt-[2vh] flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    onClose();
                  }}
                  className="flex-1 py-[1.5vh] border border-subtle text-responsive-sm text-muted font-serif italic rounded-xl hover:bg-card transition-colors"
                >
                  {t('common.back')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-[1.5vh] bg-red-600 text-white text-responsive-sm font-serif italic rounded-xl hover:bg-red-500 transition-all shadow-xl shadow-red-900/20"
                >
                  {t('lobby.practice.btn_start')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
