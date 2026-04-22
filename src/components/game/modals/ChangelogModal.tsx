import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Calendar, User, Terminal } from 'lucide-react';
import { useTranslation } from '../../../contexts/I18nContext';
import { CHANGELOG_DATA, ChangelogUpdate } from '../../../data/changelogData';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  discordLink: string;
  playSound: (sound: string) => void;
}

const parseMarkdown = (text: string) => {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="text-sm font-bold text-primary mt-6 mb-2 uppercase tracking-wider flex items-center gap-2">
          <div className="w-1 h-3 bg-primary/40 rounded-full" />
          {line.replace('### ', '')}
        </h3>
      );
    }
    if (line.startsWith('* **')) {
      const match = line.match(/\* \*\*(.*?)\*\*(.*)/);
      if (match) {
        return (
          <div key={i} className="flex gap-2 ml-1 my-1.5 leading-relaxed">
            <span className="text-primary/60 shrink-0 mt-1">•</span>
            <p className="text-xs text-muted">
              <span className="font-bold text-white/90">{match[1]}</span>
              {match[2]}
            </p>
          </div>
        );
      }
    }
    if (line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 ml-1 my-1.5 leading-relaxed">
          <span className="text-primary/60 shrink-0 mt-1">•</span>
          <p className="text-xs text-muted">{line.replace('* ', '')}</p>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-xs text-muted leading-relaxed my-1">
        {line}
      </p>
    );
  });
};

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  discordLink,
  playSound,
}) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-base-card border border-subtle rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-subtle bg-surface-glass">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  {t('lobby.modals.changelog.title')}
                </h2>
                <p className="text-xs text-muted mt-1 uppercase tracking-widest font-mono">
                  {t('lobby.modals.changelog.subtitle')}
                </p>
              </div>
              <button
                onClick={() => { playSound('click'); onClose(); }}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-12">
              {CHANGELOG_DATA.map((update, index) => (
                <div key={update.version} className="relative">
                  {/* Vertical line connector */}
                  {index !== CHANGELOG_DATA.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-48px] w-px bg-gradient-to-b from-primary/20 via-primary/10 to-transparent" />
                  )}

                  <div className="flex gap-6">
                    {/* Version Indicator */}
                    <div className="relative shrink-0">
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center z-10 relative">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                        <span className="text-lg font-bold text-white tracking-tight leading-none">
                          {update.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono rounded uppercase">
                            {update.version}
                          </span>
                          <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-muted text-[10px] font-mono rounded uppercase">
                            {update.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-6 text-[10px] font-mono text-muted uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {update.date}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {update.author}
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-5">
                        {parseMarkdown(update.content)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer / Discord CTA */}
            <div className="p-6 border-t border-subtle bg-surface-glass">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h4 className="text-sm font-bold text-white">
                    {t('lobby.modals.changelog.join_community')}
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    {t('lobby.modals.changelog.discord_cta')}
                  </p>
                </div>
                <a
                  href={discordLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playSound('click')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-95 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('lobby.modals.changelog.join_discord')}
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
