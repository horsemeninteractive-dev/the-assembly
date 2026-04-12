import React from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'motion/react';
import { UserPlus, X, Check } from 'lucide-react';
import { useTranslation, Trans } from '../../../contexts/I18nContext';

interface FriendRequestModalProps {
  fromUsername: string;
  onAccept: () => void;
  onDeny: () => void;
}

export const FriendRequestModal: React.FC<FriendRequestModalProps> = ({
  fromUsername,
  onAccept,
  onDeny,
}) => {
  const { t } = useTranslation();

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-xs bg-surface-glass border border-subtle rounded-2xl p-6 shadow-2xl text-primary backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center border border-red-900/50">
            <UserPlus className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-thematic">{t('game.modals.friend_request.title')}</h3>
            <div className="text-sm text-muted mt-1">
              <Trans
                i18nKey="game.modals.friend_request.description"
                values={{ username: fromUsername }}
                components={{ 1: <span className="text-primary font-bold" /> }}
              />
            </div>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onDeny}
              className="flex-1 py-2 rounded-lg bg-card hover:bg-subtle text-xs font-mono uppercase tracking-widest transition-colors"
            >
              {t('game.modals.friend_request.deny')}
            </button>
            <button
              onClick={onAccept}
              className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-xs font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-3 h-3" /> {t('game.modals.friend_request.accept')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};


