import React from 'react';
import { motion } from 'motion/react';
import { Shield, Timer, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useTranslation } from '../../../contexts/I18nContext';
import { GameState, Player } from '../../../../shared/types';
import { cn } from '../../../utils/utils';

interface KickVoteModalProps {
  gameState: GameState;
  me?: Player;
  onCastVote: (vote: 'Aye' | 'Nay') => void;
  playSound: (sound: string) => void;
}

export const KickVoteModal: React.FC<KickVoteModalProps> = ({
  gameState,
  me,
  onCastVote,
  playSound,
}) => {
  const { t } = useTranslation();
  const kickVote = gameState.kickVote;

  if (!kickVote) return null;

  const target = gameState.players.find((p) => p.id === kickVote.targetId);
  const initiator = gameState.players.find((p) => p.id === kickVote.initiatorId);
  const timeLeft = Math.max(0, Math.ceil((kickVote.endsAt - Date.now()) / 1000));
  const myVote = me ? kickVote.votes[me.id] : undefined;
  const isTarget = me?.id === kickVote.targetId;

  const votesArr = Object.values(kickVote.votes);
  const ayes = votesArr.filter((v) => v === 'Aye').length;
  const livingPlayers = gameState.players.filter((p) => p.isAlive).length;
  const threshold = Math.floor(livingPlayers / 2) + 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-surface-glass border border-red-900/30 rounded-3xl overflow-hidden shadow-2xl text-primary backdrop-blur-2xl"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-mono uppercase tracking-widest">{t('game.voting.kick_vote_title', 'Kick Vote')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-900/20 border border-red-900/30 text-red-400 font-mono text-xs">
              <Timer className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-thematic tracking-wide">
              {t('game.voting.kick_vote_header', 'Expel {{name}}?', { name: target?.name ?? 'Player' })}
            </h3>
            <p className="text-secondary text-sm font-mono">
              {t('game.voting.kick_vote_initiator', 'Requested by {{name}}', { name: initiator?.name ?? 'Unknown' })}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-faint mb-2">
                <span>{t('game.voting.progress', 'Progress')}</span>
                <span>{ayes} / {threshold} {t('game.voting.required', 'Required')}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(ayes / threshold) * 100}%` }}
                />
              </div>
            </div>

            {!isTarget && !myVote && timeLeft > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onCastVote('Aye');
                    playSound('vote_aye');
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-900/20 border border-red-900/40 text-red-400 hover:bg-red-900/30 transition-all font-mono uppercase tracking-widest text-xs"
                >
                  <ThumbsUp className="w-6 h-6" />
                  {t('game.voting.aye', 'Aye')}
                </button>
                <button
                  onClick={() => {
                    onCastVote('Nay');
                    playSound('vote_nay');
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition-all font-mono uppercase tracking-widest text-xs"
                >
                  <ThumbsDown className="w-6 h-6" />
                  {t('game.voting.nay', 'Nay')}
                </button>
              </div>
            ) : (
              <div className="text-center p-6 bg-white/5 rounded-2xl border border-white/5 italic text-secondary text-sm font-mono">
                {isTarget 
                  ? t('game.voting.target_wait', 'You are being voted on...') 
                  : myVote 
                    ? t('game.voting.voted_wait', 'Vote cast. Waiting for others...')
                    : t('game.voting.vote_closed', 'Vote closed.')}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
