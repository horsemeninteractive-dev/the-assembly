import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, Scale, Target, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Role, PrivateInfo, TitleRole, AgendaStatus } from '../../../../shared/types';
import { OverseerIcon } from '../../icons';
import { cn } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface DossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  privateInfo: PrivateInfo | null;
  playSound: (key: string) => void;
}

const AgendaStatusBadge = ({ status }: { status: AgendaStatus }) => {
  const { t } = useTranslation();
  if (status === 'completed')
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono uppercase tracking-widest shrink-0">
        <CheckCircle className="w-3 h-3" />
        <span>{t('common.success')}</span>
      </div>
    );
  if (status === 'failed')
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-red-900/30 border border-red-500/40 text-red-400 text-[10px] font-mono uppercase tracking-widest shrink-0">
        <XCircle className="w-3 h-3" />
        <span>{t('common.error')}</span>
      </div>
    );
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-subtle border border-strong text-tertiary text-[10px] font-mono uppercase tracking-widest shrink-0">
      <Clock className="w-3 h-3" />
      <span>{t('game.dossier.active')}</span>
    </div>
  );
};

export const DossierModal = ({ isOpen, onClose, privateInfo, playSound }: DossierModalProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-backdrop backdrop-blur-sm flex items-center justify-center p-6"
        >
          <div className="perspective-1000 max-w-sm w-full max-h-[95vh] flex">
            <motion.div
              initial={{ opacity: 0, rotateY: -90, scale: 0.95 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="w-full bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl flex flex-col preserve-3d backdrop-blur-2xl"
            >
              <div className="p-[3vh] space-y-[2vh] flex-1 flex flex-col min-h-0 backface-hidden">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-responsive-xs uppercase tracking-[0.2em] text-muted font-mono">
                    {t('game.dossier.title')}
                  </h3>
                  <button
                    onMouseEnter={() => playSound('hover')}
                    onClick={onClose}
                    className="text-ghost hover:text-white"
                  >
                    <X className="w-[2.5vh] h-[2.5vh]" />
                  </button>
                </div>

                {privateInfo ? (
                  <div className="space-y-[2vh] flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
                    {/* Role card */}
                    <div
                      className={cn(
                        'p-[2vh] rounded-2xl border-2 text-center space-y-[1vh] shrink-0',
                        privateInfo.role === 'Civil'
                          ? 'bg-blue-900/10 border-blue-500/30'
                          : 'bg-red-900/10 border-red-500/30'
                      )}
                    >
                      <div className="text-responsive-xs text-tertiary uppercase tracking-[0.2em] font-mono">
                        {t('game.dossier.identity')}
                      </div>
                      <div className="flex justify-center">
                        {privateInfo.role === 'Civil' ? (
                          <Scale className="w-[6vh] h-[6vh] text-blue-400" />
                        ) : privateInfo.role === 'Overseer' ? (
                          <OverseerIcon className="w-[6vh] h-[6vh] text-red-500" />
                        ) : (
                          <Eye className="w-[6vh] h-[6vh] text-red-500" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'text-responsive-2xl font-thematic tracking-wide uppercase',
                          privateInfo.role === 'Civil' ? 'text-blue-400' : 'text-red-500'
                        )}
                      >
                        {privateInfo.role === 'Civil'
                          ? t('game.dossier.identity_civil')
                          : privateInfo.role === 'Overseer'
                            ? t('game.dossier.identity_overseer')
                            : t('game.dossier.identity_state')}
                      </div>
                      <div className="text-responsive-xs text-muted italic leading-tight">
                        {privateInfo.role === 'Civil'
                          ? t('game.roles.civil.flavor')
                          : privateInfo.role === 'Overseer'
                            ? t('game.roles.overseer.flavor')
                            : t('game.roles.state.flavor')}
                      </div>
                    </div>

                    {/* Personal Agenda */}
                    <div className="space-y-[1vh] shrink-0">
                      <div className="text-responsive-xs uppercase tracking-widest text-muted border-b border-subtle pb-1">
                        {t('game.dossier.agenda')}
                      </div>
                      <div
                        className={cn(
                          'p-[1.5vh] rounded-2xl border backdrop-blur-sm',
                          privateInfo.personalAgenda?.status === 'completed'
                            ? 'bg-emerald-900/10 border-emerald-500/20'
                            : privateInfo.personalAgenda?.status === 'failed'
                              ? 'bg-red-900/10 border-red-500/20'
                              : 'bg-surface-glass/40 border-default'
                        )}
                      >
                        {privateInfo.personalAgenda ? (
                          <div className="space-y-[1vh]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Target
                                  className={cn(
                                    'w-[2vh] h-[2vh] shrink-0 mt-0.5',
                                    privateInfo.personalAgenda.status === 'completed'
                                      ? 'text-emerald-400'
                                      : privateInfo.personalAgenda.status === 'failed'
                                        ? 'text-red-400'
                                        : 'text-tertiary'
                                  )}
                                />
                                <span className="text-responsive-sm font-bold text-primary uppercase tracking-wider">
                                  {privateInfo.personalAgenda.name}
                                </span>
                              </div>
                              <AgendaStatusBadge status={privateInfo.personalAgenda.status} />
                            </div>
                            <p className="text-responsive-xs text-tertiary leading-relaxed pl-[2.5vh]">
                              {privateInfo.personalAgenda.description}
                            </p>
                            {privateInfo.personalAgenda.status === 'unresolved' && (
                              <p className="text-[10px] text-faint italic pl-[2.5vh]">
                                {t('game.dossier.agenda_bonus')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-responsive-sm text-muted italic">
                            {t('game.dossier.agenda_none')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title Role */}
                    <div className="space-y-[1vh] shrink-0">
                      <div className="text-responsive-xs uppercase tracking-widest text-muted border-b border-subtle pb-1">
                        {t('game.dossier.title_role')}
                      </div>
                      <div className="bg-surface-glass/40 p-[1.5vh] rounded-2xl border border-subtle backdrop-blur-sm">
                        {privateInfo.titleRole ? (
                          <div className="space-y-0.5">
                            <div className="text-responsive-sm font-bold text-primary uppercase tracking-wider">
                              {t(`game.titles.${privateInfo.titleRole.toLowerCase()}.name`)}
                            </div>
                            <div className="text-responsive-xs text-tertiary leading-tight">
                              {t(`game.titles.${privateInfo.titleRole.toLowerCase()}.desc`)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-responsive-sm text-muted italic">
                            {t('game.dossier.title_none')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* State faction */}
                    {privateInfo.stateAgents && (
                      <div className="space-y-[1vh] shrink-0">
                        <div className="text-responsive-xs uppercase tracking-widest text-muted border-b border-subtle pb-1">
                          {t('game.dossier.faction_state')}
                        </div>
                        <div className="space-y-1">
                          {privateInfo.stateAgents.map((f) => (
                            <div key={f.id} className="flex items-center justify-between py-0.5">
                              <div className="flex items-center gap-2">
                                {f.role === 'Overseer' ? (
                                  <OverseerIcon className="w-[1.8vh] h-[1.8vh] text-red-500" />
                                ) : (
                                  <Eye className="w-[1.8vh] h-[1.8vh] text-red-500" />
                                )}
                                <span className="text-responsive-sm text-secondary truncate max-w-[120px]">
                                  {f.name}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  'text-[8px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0',
                                  f.role === 'Overseer'
                                    ? 'bg-red-900/40 text-red-500 border border-red-900/50'
                                    : 'bg-card text-muted'
                                )}
                              >
                                {f.role === 'Overseer' ? t('game.dossier.identity_overseer') : t('game.dossier.identity_state')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[15vh] flex items-center justify-center text-ghost italic text-responsive-sm">
                    {t('game.dossier.awaiting')}
                  </div>
                )}

                <button
                  onMouseEnter={() => playSound('hover')}
                  onClick={onClose}
                  className="w-full py-[1.2vh] bg-card text-primary rounded-xl hover:bg-subtle transition-all text-responsive-sm font-serif italic shrink-0"
                >
                  {t('game.dossier.close')}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


