import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Scale } from 'lucide-react';
import { Policy } from '../../../../shared/types';
import { cn } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface PolicyPeekModalProps {
  policies: Policy[] | null;
  title?: string;
  onClose: () => void;
  playSound: (key: string) => void;
}

export const PolicyPeekModal = ({ policies, title, onClose, playSound }: PolicyPeekModalProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {policies && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] bg-backdrop-heavy backdrop-blur-md flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full bg-surface-glass border border-default rounded-3xl p-8 text-center space-y-8 shadow-2xl backdrop-blur-2xl"
          >
            <div className="space-y-2">
              <div className="w-12 h-12 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto border border-yellow-900/50 mb-4">
                <Eye className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted font-mono">
                {t('game.modals.policy_peek.title')}
              </h3>
              <p className="text-lg font-serif italic text-primary">
                {title || t('game.modals.policy_peek.subtitle')}
              </p>
            </div>
            <div className="flex justify-center gap-4">
              {policies.length > 0 ? (
                policies.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: i * 0.2 }}
                    className={cn(
                      'w-20 h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 shadow-xl backdrop-blur-sm',
                      p === 'Civil'
                        ? 'bg-blue-900/20 border-blue-500/50 text-blue-400'
                        : 'bg-red-900/20 border-red-500/50 text-red-500'
                    )}
                  >
                    {p === 'Civil' ? <Scale className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                    <span className="text-[8px] font-mono uppercase tracking-widest">
                      {p === 'Civil' ? t('game.modals.investigation.civil') : t('game.modals.investigation.state')}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="text-ghost font-mono text-xs italic py-8">
                  {t('game.modals.policy_peek.empty')}
                </div>
              )}
            </div>
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={onClose}
              className="w-full py-3 bg-card text-primary rounded-xl hover:bg-subtle transition-all text-sm font-serif italic border border-default"
            >
              {t('game.modals.policy_peek.end')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


