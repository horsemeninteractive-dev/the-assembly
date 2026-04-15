import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Scale, Eye } from 'lucide-react';
import { GameState } from '../../../../shared/types';
import { cn } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface RoundHistoryProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
}

export const RoundHistory = ({ gameState, isOpen, onClose }: RoundHistoryProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[150] bg-elevated flex flex-col"
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-subtle shrink-0 bg-surface">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="font-thematic text-lg uppercase tracking-wider text-primary">
                {t('game.round_history.title')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-white transition-colors bg-card rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar overscroll-contain">
            {!gameState.roundHistory || gameState.roundHistory.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-ghost font-mono text-xs uppercase tracking-widest">
                {t('game.round_history.empty')}
              </div>
            ) : (
              [...gameState.roundHistory].reverse().map((entry, i) => {
                const isFailed = entry.failed;
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-2xl border overflow-hidden',
                      isFailed
                        ? 'border-default bg-elevated'
                        : entry.policy === 'Civil'
                          ? 'border-blue-900/40 bg-blue-900/5'
                          : 'border-red-900/40 bg-red-900/5'
                    )}
                  >
                    {/* Header */}
                    <div
                      className={cn(
                        'px-4 py-2 flex items-center justify-between',
                        isFailed
                          ? 'bg-surface'
                          : entry.policy === 'Civil'
                            ? 'bg-blue-900/20'
                            : 'bg-red-900/20'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-ghost">
                          {t('game.round_history.round', { round: entry.round })}
                        </span>
                        {entry.chaos && (
                          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-orange-900/30 border border-orange-500/30 text-orange-400 uppercase tracking-widest">
                            {t('game.round_history.chaos')}
                          </span>
                        )}
                        {isFailed && (
                          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-card border border-default text-muted uppercase tracking-widest">
                            {entry.failReason === 'veto' ? t('game.round_history.vetoed') : t('game.round_history.rejected')}
                          </span>
                        )}
                      </div>
                      {isFailed ? (
                        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-faint">
                          <X className="w-3 h-3" /> {t('game.round_history.no_policy')}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest font-bold',
                            entry.policy === 'Civil' ? 'text-blue-400' : 'text-red-500'
                          )}
                        >
                          {entry.policy === 'Civil' ? (
                            <Scale className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          {entry.policy === 'Civil' ? t('game.round_history.civil') : t('game.round_history.state')}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Government */}
                      <div className="flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-yellow-900/20 border border-yellow-500/20 text-yellow-500 font-mono text-[8px] uppercase">
                            {t('game.round_history.pres_short')}
                          </span>
                          <span className="text-primary/80">
                            {entry.presidentName.replace(' (AI)', '')}
                          </span>
                        </div>
                        <div className="text-whisper">×</div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/20 border border-blue-500/20 text-blue-400 font-mono text-[8px] uppercase">
                            {t('game.round_history.chan_short')}
                          </span>
                          <span className="text-primary/80">
                            {entry.chancellorName.replace(' (AI)', '')}
                          </span>
                        </div>
                      </div>

                      {/* Declarations */}
                      {!isFailed && (entry.presDeclaration || entry.chanDeclaration) && (
                        <div className="flex gap-2">
                          {entry.presDeclaration && (
                            <div className="flex-1 p-2 rounded-lg bg-surface border border-subtle text-[9px] font-mono space-y-1">
                              <div className="text-yellow-500 uppercase tracking-widest">
                                {t('game.round_history.president')}
                              </div>
                              <div>
                                <span className="text-faint">{t('game.round_history.drew')} </span>
                                <span className="text-blue-400">
                                  {entry.presDeclaration.drewCiv}{t('common.civil_short')}
                                </span>
                                <span className="text-ghost mx-0.5">/</span>
                                <span className="text-red-500">{entry.presDeclaration.drewSta}{t('common.state_short')}</span>
                              </div>
                              <div>
                                <span className="text-faint">{t('game.round_history.passed')} </span>
                                <span className="text-blue-400">{entry.presDeclaration.civ}{t('common.civil_short')}</span>
                                <span className="text-ghost mx-0.5">/</span>
                                <span className="text-red-500">{entry.presDeclaration.sta}{t('common.state_short')}</span>
                              </div>
                            </div>
                          )}
                          {entry.chanDeclaration && (
                            <div className="flex-1 p-2 rounded-lg bg-surface border border-subtle text-[9px] font-mono space-y-1">
                              <div className="text-blue-400 uppercase tracking-widest">
                                {t('game.round_history.chancellor')}
                              </div>
                              <div className="text-faint text-[8px]">&nbsp;</div>
                              <div>
                                <span className="text-faint">{t('game.round_history.received')} </span>
                                <span className="text-blue-400">{entry.chanDeclaration.civ}{t('common.civil_short')}</span>
                                <span className="text-ghost mx-0.5">/</span>
                                <span className="text-red-500">{entry.chanDeclaration.sta}{t('common.state_short')}</span>
                                {entry.presDeclaration &&
                                  entry.chanDeclaration &&
                                  entry.presDeclaration.sta !== entry.chanDeclaration.sta && (
                                    <span
                                      className="ml-1.5 text-orange-400 font-bold"
                                      title="Stories don't match"
                                    >
                                      ⚠
                                    </span>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Votes */}
                      {entry.votes.length > 0 && (
                        <div>
                          <div className="text-[8px] font-mono text-ghost uppercase tracking-widest mb-1.5">
                            {t('game.round_history.votes')}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.votes.map((v, vi) => (
                              <div
                                key={vi}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono border',
                                  v.vote === 'Aye'
                                    ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
                                    : 'bg-red-900/20 border-red-500/30 text-red-400'
                                )}
                              >
                                <span>{v.playerName.replace(' (AI)', '')}</span>
                                <span className="font-bold">{v.vote === 'Aye' ? t('game.round_history.aye') : t('game.round_history.nay')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isFailed && entry.executiveAction && (
                        <div className="text-[8px] font-mono text-orange-400/70 uppercase tracking-widest">
                          {t('game.round_history.executive')}: {t(`game.round_history.actions.${entry.executiveAction.toLowerCase()}`)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


