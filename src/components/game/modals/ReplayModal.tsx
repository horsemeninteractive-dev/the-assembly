import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  X, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Info
} from 'lucide-react';
import { GameState, Player, Policy } from '../../../../shared/types';
import { cn, getProxiedUrl } from '../../../utils/utils';

import { useTranslation, Trans } from '../../../contexts/I18nContext';
interface ReplayModalProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
  playSound: (key: string) => void;
}

const PolicyIcon = ({ type, size = "w-4 h-4" }: { type: Policy; size?: string }) => {
  const { t } = useTranslation();
  return (
    <div className={cn(
      "rounded-sm flex items-center justify-center font-bold text-[10px]",
      size,
      type === 'Civil' ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
    )}>
      {type === 'Civil' ? t('common.civil_short') : t('common.state_short')}
    </div>
  );
};

export const ReplayModal = ({ gameState, isOpen, onClose, playSound }: ReplayModalProps) => {
  const { t } = useTranslation();
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [showTruth, setShowTruth] = useState(false);

  const history = gameState.roundHistory || [];
  const currentRound = history[currentRoundIdx];

  if (!isOpen) return null;

  const nextRound = () => {
    if (currentRoundIdx < history.length - 1) {
      setCurrentRoundIdx(curr => curr + 1);
      playSound('click');
    }
  };

  const prevRound = () => {
    if (currentRoundIdx > 0) {
      setCurrentRoundIdx(curr => curr - 1);
      playSound('click');
    }
  };

  const toggleTruth = () => {
    setShowTruth(!showTruth);
    playSound('hover');
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-backdrop-heavy backdrop-blur-xl flex items-center justify-center p-4 lg:p-8"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-4xl bg-surface-glass border border-default rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-subtle flex items-center justify-between bg-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-thematic text-xl lg:text-2xl uppercase tracking-[0.2em] text-primary">{t('game.match_replay.title')}</h2>
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest">{t('game.match_replay.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTruth}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-mono text-[10px] uppercase tracking-widest font-bold",
                  showTruth 
                    ? "bg-red-500/10 border-red-500/30 text-red-500" 
                    : "bg-surface border-default text-muted hover:text-white"
                )}
              >
                {showTruth ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showTruth ? t('game.match_replay.hide_deceptions') : t('game.match_replay.reveal_truth')}
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-white transition-colors bg-card hover:bg-hover rounded-xl border border-default"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {!currentRound ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted gap-4">
              <History className="w-12 h-12 opacity-20" />
              <p className="font-mono text-xs uppercase tracking-widest">{t('game.match_replay.no_history')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Round Selector / Timeline */}
                <div className="lg:col-span-12 flex items-center justify-between bg-elevated/40 rounded-3xl p-4 border border-default">
                  <button 
                    disabled={currentRoundIdx === 0}
                    onClick={prevRound}
                    className="p-2 rounded-xl bg-card border border-default hover:bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <div className="flex-1 flex justify-center gap-2 overflow-x-auto no-scrollbar px-4">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentRoundIdx(i); playSound('click'); }}
                        className={cn(
                          "w-10 h-10 shrink-0 rounded-xl border transition-all font-mono text-xs flex items-center justify-center",
                          currentRoundIdx === i 
                            ? "bg-primary border-primary text-white scale-110 shadow-lg" 
                            : "bg-card border-default text-muted hover:border-primary/50"
                        )}
                      >
                        {h.round}
                      </button>
                    ))}
                  </div>

                  <button 
                    disabled={currentRoundIdx === history.length - 1}
                    onClick={nextRound}
                    className="p-2 rounded-xl bg-card border border-default hover:bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Main content grid */}
                <div className="lg:col-span-5 space-y-8">
                  <section>
                    <h3 className="text-[10px] font-mono text-faint uppercase tracking-[0.3em] mb-4">
                      {t('game.match_replay.government_header', { round: currentRound.round })}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 bg-surface/40 p-4 rounded-2xl border border-subtle">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500 shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest mb-0.5">{t('game.match_replay.president')}</p>
                          <p className="text-primary font-thematic uppercase truncate">{currentRound.presidentName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-surface/40 p-4 rounded-2xl border border-subtle">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest mb-0.5">{t('game.match_replay.chancellor')}</p>
                          <p className="text-primary font-thematic uppercase truncate">{currentRound.chancellorName}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-mono text-faint uppercase tracking-[0.3em]">{t('game.match_replay.session_summary')}</h3>
                      {currentRound.chaos && (
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[8px] font-mono uppercase tracking-widest">{t('game.match_replay.chaos_forced')}</span>
                      )}
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl border text-center transition-all duration-500",
                      currentRound.failed 
                        ? "bg-surface border-default text-muted" 
                        : currentRound.policy === 'Civil' 
                          ? "bg-blue-900/10 border-blue-500/30 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.1)]" 
                          : "bg-red-900/10 border-red-500/30 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                    )}>
                      {currentRound.failed ? (
                        <>
                          <p className="text-2xl font-thematic uppercase tracking-wider mb-2">{t('game.match_replay.rejected')}</p>
                          <p className="text-xs font-mono opacity-60">
                            {currentRound.failReason === 'veto' ? t('game.match_replay.fail_veto') : t('game.match_replay.fail_default')}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-60 mb-2">{t('game.match_replay.enacted')}</p>
                          <p className="text-3xl lg:text-4xl font-thematic uppercase tracking-[0.1em]">
                            {currentRound.policy === 'Civil' ? t('game.policies.civil.name') : t('game.policies.state.name')}
                          </p>
                          {currentRound.executiveAction && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <p className="text-[9px] font-mono text-orange-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                {t('game.match_replay.power_triggered', { 
                                  action: currentRound.executiveAction 
                                    ? t(`game.powers.${currentRound.executiveAction.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}`)
                                    : ''
                                })}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-7 space-y-8">
                  {/* The Legislative Hand */}
                  {!currentRound.failed && (currentRound.presDeclaration || currentRound.chanDeclaration) && (
                    <section>
                      <h3 className="text-[10px] font-mono text-faint uppercase tracking-[0.3em] mb-4">{t('game.match_replay.legislative_hand')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* President's Hand */}
                        <div className="bg-elevated/30 rounded-3xl border border-default p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-faint uppercase font-bold">{t('game.match_replay.pres_deck')}</span>
                            {showTruth && currentRound.presDeclaration && (
                              (() => {
                                const lied = currentRound.presDeclaration.civ !== (currentRound.presDeclaration.drewCiv ?? 0);
                                return lied && <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase font-bold">{t('game.match_replay.deception_detected')}</span>;
                              })()
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                              <p className="text-[8px] font-mono uppercase tracking-widest text-ghost">{t('game.match_replay.actual_draw')}</p>
                              <div className="flex gap-1.5 grayscale opacity-40">
                                {showTruth && currentRound.presDeclaration ? (
                                  <>
                                    {Array(currentRound.presDeclaration.drewCiv).fill(0).map((_, i) => <PolicyIcon key={`t-p-c-${i}`} type="Civil" size="w-6 h-8" />)}
                                    {Array(currentRound.presDeclaration.drewSta).fill(0).map((_, i) => <PolicyIcon key={`t-p-s-${i}`} type="State" size="w-6 h-8" />)}
                                  </>
                                ) : (
                                  <div className="w-10 h-8 rounded border border-dashed border-default flex items-center justify-center text-[8px] text-faint">{t('game.match_replay.hidden')}</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-[8px] font-mono uppercase tracking-widest text-ghost">{t('game.match_replay.public_claim')}</p>
                              <div className="flex gap-1.5">
                                {Array(currentRound.presDeclaration?.civ).fill(0).map((_, i) => <PolicyIcon key={`c-p-c-${i}`} type="Civil" size="w-6 h-8" />)}
                                {Array(currentRound.presDeclaration?.sta).fill(0).map((_, i) => <PolicyIcon key={`c-p-s-${i}`} type="State" size="w-6 h-8" />)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chancellor's Hand */}
                        <div className="bg-elevated/30 rounded-3xl border border-default p-5 space-y-4">
                           <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-faint uppercase font-bold">{t('game.match_replay.chan_hand')}</span>
                            {showTruth && currentRound.chanDeclaration && currentRound.presDeclaration && (
                                (currentRound.presDeclaration.sta !== currentRound.chanDeclaration.sta || currentRound.presDeclaration.civ !== currentRound.chanDeclaration.civ) && 
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase font-bold">{t('game.match_replay.conflicting_stories')}</span>
                            )}
                          </div>

                          <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <p className="text-[8px] font-mono uppercase tracking-widest text-ghost">{t('game.match_replay.actual_received')}</p>
                                <div className="flex gap-1.5 grayscale opacity-40">
                                  {showTruth && currentRound.presDeclaration ? (
                                    <>
                                      {Array(currentRound.presDeclaration.civ).fill(0).map((_, i) => <PolicyIcon key={`t-c-c-${i}`} type="Civil" size="w-6 h-8" />)}
                                      {Array(currentRound.presDeclaration.sta).fill(0).map((_, i) => <PolicyIcon key={`t-c-s-${i}`} type="State" size="w-6 h-8" />)}
                                    </>
                                  ) : (
                                    <div className="w-10 h-8 rounded border border-dashed border-default flex items-center justify-center text-[8px] text-faint">{t('game.match_replay.hidden')}</div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <p className="text-[8px] font-mono uppercase tracking-widest text-ghost">{t('game.match_replay.public_claim')}</p>
                                <div className="flex gap-1.5">
                                  {Array(currentRound.chanDeclaration?.civ).fill(0).map((_, i) => <PolicyIcon key={`c-c-c-${i}`} type="Civil" size="w-6 h-8" />)}
                                  {Array(currentRound.chanDeclaration?.sta).fill(0).map((_, i) => <PolicyIcon key={`c-c-s-${i}`} type="State" size="w-6 h-8" />)}
                                </div>
                              </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Voting Records */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-mono text-faint uppercase tracking-[0.3em]">{t('game.match_replay.voting_records')}</h3>
                      <div className="flex gap-4">
                         <div className="flex items-center gap-1.5 text-[8px] font-mono text-emerald-400 uppercase tracking-widest">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> {t('game.match_replay.aye')}
                         </div>
                         <div className="flex items-center gap-1.5 text-[8px] font-mono text-red-500 uppercase tracking-widest">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> {t('game.match_replay.nay')}
                         </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {currentRound.votes.length === 0 ? (
                        <div className="col-span-full py-4 text-center text-ghost italic text-[10px]">{t('game.match_replay.no_vote')}</div>
                      ) : (
                        currentRound.votes.map((v, idx) => (
                          <div 
                            key={idx}
                            className={cn(
                              "p-2.5 rounded-xl border flex items-center justify-between transition-all duration-300",
                              v.vote === 'Aye' 
                                ? "bg-emerald-900/10 border-emerald-500/20 text-emerald-100" 
                                : "bg-red-900/10 border-red-500/20 text-red-100"
                            )}
                          >
                            <span className="text-[9px] font-medium truncate pr-2">{v.playerName.replace(' (AI)', '')}</span>
                            <span className={cn(
                              "text-[8px] font-mono font-bold uppercase",
                              v.vote === 'Aye' ? "text-emerald-400" : "text-red-400"
                            )}>{v.vote === 'Aye' ? t('game.match_replay.aye') : t('game.match_replay.nay')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* Footer / Controls */}
          <div className="p-6 border-t border-subtle bg-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-muted">
              <Info className="w-4 h-4" />
              <p className="text-[10px] font-mono uppercase tracking-widest max-w-xs leading-relaxed">
                {t('game.match_replay.footer_info')}
              </p>
            </div>
            
            <div className="flex gap-3">
               <button
                onClick={onClose}
                className="px-8 py-3 bg-card border border-default rounded-2xl hover:bg-hover transition-all font-thematic text-sm uppercase tracking-widest text-primary"
              >
                {t('game.match_replay.close')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
