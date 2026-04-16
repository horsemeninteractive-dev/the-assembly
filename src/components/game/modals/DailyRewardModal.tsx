import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Coins, Sparkles, TrendingUp, X } from 'lucide-react';
import { useTranslation } from '../../../contexts/I18nContext';

interface DailyRewardModalProps {
  reward: { bonusXp: number; bonusIp: number; streak: number };
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ reward, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-surface-glass border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header/Banner */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="z-10 bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/40 shadow-inner"
          >
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </motion.div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-ghost hover:text-white hover:bg-white/10 rounded-xl transition-all z-20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6 text-center">
          <div>
            <h2 className="text-3xl font-thematic uppercase tracking-widest text-primary mb-1">
              {t('lobby.daily_reward.title')}
            </h2>
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-mono text-sm uppercase tracking-tighter">
              <TrendingUp className="w-4 h-4" />
              <span>{t('lobby.daily_reward.streak_label', { count: reward.streak })}</span>
            </div>
          </div>

          <p className="text-muted text-sm leading-relaxed max-w-[280px] mx-auto">
            {t('lobby.daily_reward.subtitle')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-card/50 border border-subtle p-4 rounded-2xl flex flex-col items-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-xl font-thematic text-primary">+{reward.bonusXp}</div>
              <div className="text-[10px] font-mono uppercase text-purple-400 tracking-widest">XP</div>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-card/50 border border-subtle p-4 rounded-2xl flex flex-col items-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Coins className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-xl font-thematic text-primary">+{reward.bonusIp}</div>
              <div className="text-[10px] font-mono uppercase text-emerald-400 tracking-widest">IP</div>
            </motion.div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest font-mono text-sm"
          >
            {t('common.confirm_cta')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
