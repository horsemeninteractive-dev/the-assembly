import React from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  LogOut,
  BookOpen,
  Scale,
  Eye,
  Mic,
  MicOff,
  User as UserIcon,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { GameState, Player, Role, PrivateInfo } from '../../../shared/types';
import { OverseerIcon } from '../icons';
import { getFrameStyles } from '../../utils/cosmetics';
import { cn, getProxiedUrl } from '../../utils/utils';
import { useTranslation } from '../../contexts/I18nContext';

interface GameHeaderProps {
  gameState: GameState;
  me: Player | undefined;
  socketId: string | undefined;
  user: { username: string; avatarUrl?: string; activeFrame?: string } | null;
  privateInfo: PrivateInfo | null;
  hasNewMessages: boolean;
  tick: number;
  onOpenChat: () => void;
  onOpenHistory: () => void;
  onOpenDossier: () => void;
  onOpenProfile: () => void;
  onOpenReference: () => void;
  onLeaveRoom: () => void;
  playSound: (key: string) => void;
}

export const GameHeader = ({
  gameState,
  me,
  socketId,
  user,
  privateInfo,
  hasNewMessages,
  tick,
  onOpenChat,
  onOpenHistory,
  onOpenDossier,
  onOpenProfile,
  onOpenReference,
  onLeaveRoom,
  playSound,
}: GameHeaderProps) => {
  const { t } = useTranslation();
  const timerRemaining = gameState.actionTimerEnd
    ? Math.max(0, Math.ceil((gameState.actionTimerEnd - Date.now()) / 1000))
    : null;

  const predictions = gameState.spectatorPredictions ? Object.values(gameState.spectatorPredictions) : [];
  const civilPreds = predictions.filter(p => p.prediction === 'Civil').length;
  const statePreds = predictions.filter(p => p.prediction === 'State').length;
  const totalPreds = predictions.length;
  const civilPercent = totalPreds > 0 ? Math.round((civilPreds / totalPreds) * 100) : 50;
  const statePercent = 100 - civilPercent;

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="h-[8vh] sm:h-[10vh] border-b border-subtle bg-surface-glass px-5 flex items-center justify-between shrink-0 shadow-lg z-10"
    >
      <div className="flex items-center gap-[1vw] sm:gap-[2vw]">
        <div className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] bg-elevated rounded-xl flex items-center justify-center border border-white/40 shrink-0 overflow-hidden">
          <img
            src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
            alt="The Assembly Logo"
            className="w-full h-full object-contain p-1"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Spectator Prediction Tally (Center Piece) */}
      {totalPreds > 0 && gameState.phase !== 'Lobby' && gameState.phase !== 'GameOver' && (
        <div className="hidden md:flex flex-col items-center gap-1 min-w-[150px] lg:min-w-[200px]">
          <div className="flex justify-between w-full text-[10px] font-mono uppercase tracking-widest text-faint">
            <span className={cn(civilPercent > statePercent && "text-blue-400 font-bold")}>{t('game.game_header.prediction_civil', { percent: civilPercent })}</span>
            <span className={cn(statePercent > civilPercent && "text-red-400 font-bold")}>{t('game.game_header.prediction_state', { percent: statePercent })}</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden flex border border-white/5 backdrop-blur-sm">
            <motion.div 
              initial={{ width: '50%' }}
              animate={{ width: `${civilPercent}%` }}
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
            />
            <motion.div 
              initial={{ width: '50%' }}
              animate={{ width: `${statePercent}%` }}
              className="h-full bg-gradient-to-l from-red-600 to-red-400"
            />
          </div>
          <div className="text-[9px] font-mono text-ghost/40 uppercase tracking-[0.2em] leading-none">
            {totalPreds === 1 
              ? t('game.game_header.spectator_vote', { count: totalPreds }) 
              : t('game.game_header.spectator_votes', { count: totalPreds })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-[1vw] sm:gap-[2vw]">
        {/* Chat */}
        <Tooltip content={t('game.game_header.open_chat')}>
          <button
            onClick={() => {
              playSound('click');
              onOpenChat();
            }}
            className="p-[1vh] sm:p-[1.2vh] rounded-xl border border-default bg-card text-muted hover:text-white transition-all relative"
          >
            <MessageSquare className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh]" />
            {hasNewMessages && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full border border-deep" />
            )}
          </button>
        </Tooltip>

        {/* History */}
        {gameState.roundHistory && gameState.roundHistory.length > 0 && (
          <Tooltip content={t('game.game_header.round_history')}>
            <button
              onClick={() => {
                playSound('click');
                onOpenHistory();
              }}
              className="p-[1vh] sm:p-[1.2vh] rounded-xl border border-default bg-card text-muted hover:text-white transition-all relative"
            >
              <BookOpen className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh]" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-500 rounded-full border border-deep flex items-center justify-center">
                <span className="text-[7px] font-bold text-black leading-none">
                  {gameState.roundHistory.length}
                </span>
              </span>
            </button>
          </Tooltip>
        )}

        {/* Help / Reference */}
        {gameState.phase !== 'Lobby' && gameState.phase !== 'GameOver' && (
          <Tooltip content={t('game.game_header.phase_reference')}>
            <button
              onClick={() => {
                playSound('click');
                onOpenReference();
              }}
              className="p-[1vh] sm:p-[1.2vh] rounded-xl border border-default bg-card text-muted hover:text-blue-400 hover:border-blue-900/50 transition-all"
            >
              <HelpCircle className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh]" />
            </button>
          </Tooltip>
        )}

        {/* Dossier */}
        {gameState.phase !== 'Lobby' && (
          <Tooltip content={t('game.game_header.your_dossier')}>
            <button
              onClick={() => {
                playSound('click');
                onOpenDossier();
              }}
              className={cn(
                'p-[1vh] sm:p-[1.2vh] rounded-xl border transition-all',
                privateInfo
                  ? privateInfo.role === 'Civil'
                    ? 'border-blue-900/50 bg-blue-900/20'
                    : 'border-red-900/50 bg-red-900/20'
                  : 'border-default bg-card'
              )}
            >
              {privateInfo?.role === 'Civil' ? (
                <Scale className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh] text-blue-400" />
              ) : privateInfo?.role === 'Overseer' ? (
                <OverseerIcon className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh] text-red-500" />
              ) : (
                <Eye
                  className={cn(
                    'w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh]',
                    privateInfo ? 'text-red-500' : 'text-muted'
                  )}
                />
              )}
            </button>
          </Tooltip>
        )}

        {/* Profile */}
        <Tooltip content={t('game.game_header.my_profile')}>
          <button
            onClick={() => {
              playSound('click');
              onOpenProfile();
            }}
            className="w-[4vh] h-[4vh] sm:w-[5vh] sm:h-[5vh] rounded-xl bg-card border border-default flex items-center justify-center hover:border-red-900/50 transition-colors relative shrink-0"
          >
            {user?.avatarUrl ? (
              <img
                src={getProxiedUrl(user.avatarUrl)}
                alt={user.username}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <UserIcon className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh] text-muted" />
            )}
            {user?.activeFrame && (
              <div
                className={cn(
                  'absolute inset-0 rounded-xl pointer-events-none',
                  getFrameStyles(user.activeFrame)
                )}
              />
            )}
          </button>
        </Tooltip>

        <div className="w-[1px] h-[2.5vh] sm:h-[3vh] bg-card mx-0.5 sm:mx-1" />

        {/* Leave */}
        <Tooltip content={t('game.game_header.leave_assembly')}>
          <button
            onClick={onLeaveRoom}
            className="p-[1vh] sm:p-[1.2vh] text-ghost hover:text-red-500 transition-colors bg-elevated border border-subtle rounded-xl"
          >
            <LogOut className="w-[1.8vh] h-[1.8vh] sm:w-[2vh] sm:h-[2vh]" />
          </button>
        </Tooltip>
      </div>
    </motion.header>
  );
};


