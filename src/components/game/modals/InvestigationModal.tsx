import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, Eye } from 'lucide-react';
import { Role } from '../../../../shared/types';
import { cn } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface InvestigationModalProps {
  result: { targetName: string; role: Role } | null;
  onClose: () => void;
  playSound: (key: string) => void;
}

export const InvestigationModal = ({ result, onClose, playSound }: InvestigationModalProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {result && (
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
            className="max-w-sm w-full bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl p-8 text-center space-y-6 backdrop-blur-2xl"
          >
            <div className="w-16 h-16 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto border border-yellow-900/50">
              {result.role === 'Civil' ? (
                <Scale className="w-8 h-8 text-blue-400" />
              ) : (
                <Eye className="w-8 h-8 text-red-500" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted font-mono">
                {t('game.modals.investigation.title')}
              </h3>
              <p className="text-xl font-serif italic text-primary">
                {t('game.modals.investigation.is_a', { name: result.targetName.replace(' (AI)', '') })}
              </p>
            </div>
            <div
              className={cn(
                'text-4xl font-serif italic py-4 rounded-2xl border-2',
                result.role === 'Civil'
                  ? 'bg-blue-900/10 border-blue-500/30 text-blue-400'
                  : 'bg-red-900/10 border-red-500/30 text-red-500'
              )}
            >
              {result.role === 'Civil' ? t('game.modals.investigation.civil') : t('game.modals.investigation.state')}
            </div>
            <button
              onMouseEnter={() => playSound('hover')}
              onClick={onClose}
              className="w-full py-3 bg-card text-primary rounded-xl hover:bg-subtle transition-all text-sm font-serif italic"
            >
              {t('game.modals.investigation.understood')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


