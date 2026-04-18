import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Award, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../contexts/I18nContext';
import { RANK_TIERS } from '../../../sharedConstants';
import { useAudioContext } from '../../../contexts/AudioContext';

interface SeasonalRewardsModalProps {
  reward: {
    tier: string;
    ipReward: number;
    cpReward: number;
    seasonPeriod: string;
  } | null;
  onClose: () => void;
}

export const SeasonalRewardsModal: React.FC<SeasonalRewardsModalProps> = ({ reward, onClose }) => {
  const { t } = useTranslation();
  const { playSound } = useAudioContext();

  if (!reward) return null;

  const tierInfo = RANK_TIERS[reward.tier as keyof typeof RANK_TIERS] || RANK_TIERS.BRONZE;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md overflow-hidden bg-base border border-subtle rounded-2xl shadow-2xl"
      >
        {/* Background Sparkle Animation */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-conic from-primary/40 via-transparent to-transparent blur-3xl opacity-30"
          />
        </div>

        <div className="relative p-8 flex flex-col items-center text-center gap-6">
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-24 h-24 bg-elevated rounded-3xl flex items-center justify-center border-2 border-primary shadow-xl shadow-primary/20 relative"
          >
            <Trophy className={`w-12 h-12 ${tierInfo.color}`} />
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2 text-yellow-400"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-3xl font-serif text-primary tracking-tight">
              {t('season.rewards.title', { period: reward.seasonPeriod })}
            </h2>
            <p className="text-muted text-sm font-mono uppercase tracking-widest">
              {t('season.rewards.tier_reached', { tier: tierInfo.name })}
            </p>
          </div>

          <div className="w-full grid grid-cols-2 gap-4">
            <div className="bg-surface-glass border border-subtle p-4 rounded-xl flex flex-col items-center gap-1 group hover:border-primary/50 transition-colors">
              <div className="p-2 bg-base rounded-lg shadow-sm border border-subtle text-amber-500">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold font-mono">+{reward.ipReward.toLocaleString()}</span>
              <span className="text-[10px] text-muted uppercase font-mono tracking-tighter">Influence Points</span>
            </div>

            <div className="bg-surface-glass border border-subtle p-4 rounded-xl flex flex-col items-center gap-1 group hover:border-cyan-500/50 transition-colors">
              <div className="p-2 bg-base rounded-lg shadow-sm border border-subtle text-cyan-400">
                <Award className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold font-mono">+{reward.cpReward.toLocaleString()}</span>
              <span className="text-[10px] text-muted uppercase font-mono tracking-tighter">Cabinet Points</span>
            </div>
          </div>

          <p className="text-ghost text-xs italic">
            {t('season.rewards.rollover_desc')}
          </p>

          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            onMouseEnter={() => playSound('hover')}
            className="w-full py-4 bg-primary text-black font-bold uppercase tracking-widest rounded-xl hover:bg-white active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            {t('season.rewards.collect')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
