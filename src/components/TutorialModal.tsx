import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Scale,
  Eye,
  Target,
  Vote,
  FileText,
  Zap,
  Crown,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { OverseerIcon } from './icons';
import { useTranslation } from '../contexts/I18nContext';
import { cn } from '../utils/utils';

interface TutorialModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface TutorialStep {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  content: React.ReactNode;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onComplete, onSkip }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const STEPS: TutorialStep[] = [
    {
      id: 'premise',
      title: t('game.tutorial.premise.title'),
      subtitle: t('game.tutorial.premise.subtitle'),
      icon: <Shield className="w-8 h-8" />,
      accentColor: 'text-primary',
      content: (
        <div className="space-y-4">
          <p className="text-secondary leading-relaxed">
            {t('game.tutorial.premise.p1', {
              crisis: <span className="text-primary font-medium">The Crisis</span>,
            })}
          </p>
          <p className="text-secondary leading-relaxed">
            {t('game.tutorial.premise.p2', {
              overseer: <span className="text-red-400 font-medium">Overseer</span>,
            })}
          </p>
          <div className="bg-card rounded-xl p-4 border border-default">
            <p className="text-tertiary text-sm font-mono uppercase tracking-widest mb-2">
              {t('game.tutorial.premise.label')}
            </p>
            <p className="text-primary text-sm leading-relaxed">
              {t('game.tutorial.premise.desc')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      title: t('game.tutorial.roles.title'),
      subtitle: t('game.tutorial.roles.subtitle'),
      icon: <Eye className="w-8 h-8" />,
      accentColor: 'text-primary',
      content: (
        <div className="space-y-3">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex gap-4 items-start">
            <Scale className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-blue-400 font-bold uppercase tracking-wider text-sm mb-1">
                {t('game.tutorial.roles.civil.label')}
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                {t('game.tutorial.roles.civil.desc')}
              </p>
            </div>
          </div>
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex gap-4 items-start">
            <Eye className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-red-400 font-bold uppercase tracking-wider text-sm mb-1">
                {t('game.tutorial.roles.state.label')}
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                {t('game.tutorial.roles.state.desc')}
              </p>
            </div>
          </div>
          <div className="bg-red-900/30 border border-red-600/50 rounded-xl p-4 flex gap-4 items-start">
            <OverseerIcon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-red-500 font-bold uppercase tracking-wider text-sm mb-1">
                {t('game.tutorial.roles.overseer.label')}
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                {t('game.tutorial.roles.overseer.desc')}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'loop',
      title: t('game.tutorial.loop.title'),
      subtitle: t('game.tutorial.loop.subtitle'),
      icon: <Crown className="w-8 h-8" />,
      accentColor: 'text-yellow-400',
      content: (
        <div className="space-y-3">
          {[
            {
              num: '1',
              label: t('game.tutorial.loop.step_1.label'),
              desc: t('game.tutorial.loop.step_1.desc'),
            },
            {
              num: '2',
              label: t('game.tutorial.loop.step_2.label'),
              desc: t('game.tutorial.loop.step_2.desc'),
            },
            {
              num: '3',
              label: t('game.tutorial.loop.step_3.label'),
              desc: t('game.tutorial.loop.step_3.desc'),
            },
            {
              num: '4',
              label: t('game.tutorial.loop.step_4.label'),
              desc: t('game.tutorial.loop.step_4.desc'),
            },
          ].map((step) => (
            <div key={step.num} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
                <span className="text-yellow-400 text-xs font-bold">{step.num}</span>
              </div>
              <div>
                <div className="text-primary text-sm font-medium">{step.label}</div>
                <div className="text-tertiary text-xs leading-relaxed mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
          <div className="bg-card rounded-xl p-3 border border-default mt-2">
            <p className="text-muted text-xs font-mono">
              {t('game.tutorial.loop.chaos_desc', {
                chaos: <span className="text-orange-400">chaos policy</span>,
              })}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'voting',
      title: t('game.tutorial.voting.title'),
      subtitle: t('game.tutorial.voting.subtitle'),
      icon: <Vote className="w-8 h-8" />,
      accentColor: 'text-purple-400',
      content: (
        <div className="space-y-4">
          <p className="text-secondary leading-relaxed text-sm">
            {t('game.tutorial.voting.p1', {
              simultaneous: <strong className="text-primary">simultaneous and hidden</strong>,
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="text-emerald-400 font-bold text-lg font-thematic">
                {t('game.tutorial.voting.aye')}
              </div>
              <p className="text-tertiary text-xs mt-1">{t('game.tutorial.voting.aye_desc')}</p>
            </div>
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-center">
              <div className="text-red-400 font-bold text-lg font-thematic">
                {t('game.tutorial.voting.nay')}
              </div>
              <p className="text-tertiary text-xs mt-1">{t('game.tutorial.voting.nay_desc')}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-default space-y-2">
            <div className="text-tertiary text-xs font-mono uppercase tracking-widest">
              {t('game.tutorial.voting.decl_label')}
            </div>
            <p className="text-secondary text-sm leading-relaxed">
              {t('game.tutorial.voting.decl_p1', {
                true_or_false: <span className="text-yellow-400">true or false</span>,
              })}
            </p>
            <p className="text-muted text-xs italic">{t('game.tutorial.voting.decl_hint')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'executive',
      title: t('game.tutorial.executive.title'),
      subtitle: t('game.tutorial.executive.subtitle'),
      icon: <Zap className="w-8 h-8" />,
      accentColor: 'text-orange-400',
      content: (
        <div className="space-y-3">
          <p className="text-secondary text-sm leading-relaxed">
            {t('game.tutorial.executive.p1')}
          </p>
          {Object.entries(t('game.tutorial.executive.actions', { returnObjects: true })).map(
            ([key, action]: [string, any]) => (
              <div
                key={key}
                className="flex gap-3 items-start bg-card rounded-lg p-3 border border-default"
              >
                <Zap className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-orange-400 text-sm font-medium">{action.name}</div>
                  <div className="text-tertiary text-xs mt-0.5">{action.desc}</div>
                </div>
              </div>
            )
          )}
          <p className="text-faint text-xs italic">{t('game.tutorial.executive.footer')}</p>
        </div>
      ),
    },
    {
      id: 'titles',
      title: t('game.tutorial.titles.title'),
      subtitle: t('game.tutorial.titles.subtitle'),
      icon: <Crown className="w-8 h-8" />,
      accentColor: 'text-yellow-400',
      content: (
        <div className="space-y-3">
          <p className="text-secondary text-sm leading-relaxed">
            {t('game.tutorial.titles.p1', {
              title_role: <span className="text-yellow-400 font-medium">Title Role</span>,
            })}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                name: t('game.tutorial.titles.interdictor.name'),
                when: t('game.phases.nominate_chancellor'),
                desc: t('game.tutorial.titles.interdictor.desc'),
              },
              {
                name: t('game.tutorial.titles.broker.name'),
                when: t('game.phases.nomination_review'),
                desc: t('game.tutorial.titles.broker.desc'),
              },
              {
                name: t('game.tutorial.titles.strategist.name'),
                when: t('game.phases.legislative_president'),
                desc: t('game.tutorial.titles.strategist.desc'),
              },
              {
                name: t('game.tutorial.titles.auditor.name'),
                when: t('game.phases.auditor_inspect'),
                desc: t('game.tutorial.titles.auditor.desc'),
              },
              {
                name: t('game.tutorial.titles.assassin.name'),
                when: t('game.phases.assassin_target'),
                desc: t('game.tutorial.titles.assassin.desc'),
              },
              {
                name: t('game.tutorial.titles.defector.name'),
                when: t('game.phases.defector_align'),
                desc: t('game.tutorial.titles.defector.desc'),
              },
              {
                name: t('game.tutorial.titles.handler.name'),
                when: t('game.phases.legislative_chancellor'),
                desc: t('game.tutorial.titles.handler.desc'),
              },
            ].map((role) => (
              <div key={role.name} className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-yellow-500/50 shrink-0 mt-1.5" />
                <div>
                  <span className="text-yellow-400 text-sm font-medium">{role.name}</span>
                  <p className="text-tertiary text-xs mt-0.5">{role.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-faint text-xs italic">{t('game.tutorial.titles.footer')}</p>
        </div>
      ),
    },
    {
      id: 'agendas',
      title: t('game.tutorial.agendas.title'),
      subtitle: t('game.tutorial.agendas.subtitle'),
      icon: <Target className="w-8 h-8" />,
      accentColor: 'text-emerald-400',
      content: (
        <div className="space-y-4">
          <p className="text-secondary text-sm leading-relaxed">
            {t('game.tutorial.agendas.p1', {
              agenda: <span className="text-emerald-400 font-medium">Personal Agenda</span>,
            })}
          </p>
          <div className="bg-emerald-900/15 border border-emerald-500/25 rounded-xl p-4 space-y-2">
            <div className="text-emerald-400 text-xs font-mono uppercase tracking-widest">
              {t('game.tutorial.agendas.examples_label')}
            </div>
            <div className="space-y-2 text-sm">
              {t('game.tutorial.agendas.examples', { returnObjects: true }).map((a: string) => (
                <div key={a} className="flex gap-2 items-start text-secondary">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50 shrink-0 mt-0.5" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-default">
            <p className="text-muted text-xs leading-relaxed">
              {t('game.tutorial.agendas.footer', {
                bonus: <span className="text-emerald-400">+100 XP</span>,
                and: <em>and</em>,
              })}
            </p>
          </div>
          <p className="text-faint text-xs italic">{t('game.tutorial.agendas.footer_sub')}</p>
        </div>
      ),
    },
    {
      id: 'tips',
      title: t('game.tutorial.tips.title'),
      subtitle: t('game.tutorial.tips.subtitle'),
      icon: <FileText className="w-8 h-8" />,
      accentColor: 'text-blue-400',
      content: (
        <div className="space-y-3">
          {[
            {
              heading: t('game.tutorial.tips.civil.heading'),
              body: t('game.tutorial.tips.civil.body'),
              color: 'text-blue-400',
              bg: 'bg-blue-900/10 border-blue-500/20',
            },
            {
              heading: t('game.tutorial.tips.state.heading'),
              body: t('game.tutorial.tips.state.body'),
              color: 'text-red-400',
              bg: 'bg-red-900/10 border-red-500/20',
            },
            {
              heading: t('game.tutorial.tips.decl.heading'),
              body: t('game.tutorial.tips.decl.body'),
              color: 'text-yellow-400',
              bg: 'bg-yellow-900/10 border-yellow-500/20',
            },
            {
              heading: t('game.tutorial.tips.dossier.heading'),
              body: t('game.tutorial.tips.dossier.body'),
              color: 'text-purple-400',
              bg: 'bg-purple-900/10 border-purple-500/20',
            },
          ].map((tip) => (
            <div key={tip.heading} className={cn('rounded-xl p-3 border', tip.bg)}>
              <div className={cn('text-sm font-medium mb-1', tip.color)}>{tip.heading}</div>
              <p className="text-tertiary text-xs leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    setDirection(1);
    if (isLast) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  };

  const goPrev = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-backdrop-heavy backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl flex flex-col backdrop-blur-2xl"
            style={{ maxHeight: '90dvh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-subtle bg-surface-glass/40 shrink-0 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="text-muted">{current.icon}</div>
                <div>
                  <div
                    className={cn(
                      'text-lg font-thematic tracking-wide uppercase leading-none',
                      current.accentColor
                    )}
                  >
                    {current.title}
                  </div>
                  {current.subtitle && (
                    <div className="text-faint text-xs font-mono mt-0.5">{current.subtitle}</div>
                  )}
                </div>
              </div>
              <button
                onClick={onSkip}
                aria-label="Close Tutorial"
                className="text-ghost hover:text-tertiary transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -30 }}
                  transition={{ duration: 0.2 }}
                >
                  {current.content}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-subtle shrink-0 space-y-4">
              {/* Step indicators */}
              <div className="flex items-center justify-center gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setDirection(i > step ? 1 : -1);
                      setStep(i);
                    }}
                    className={cn(
                      'rounded-full transition-all',
                      i === step ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-subtle hover:bg-strong'
                    )}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                {!isFirst && (
                  <button
                    onClick={goPrev}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-card text-tertiary rounded-xl border border-default hover:bg-hover hover:text-white transition-all text-sm font-mono"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('game.tutorial.back')}
                  </button>
                )}
                <button
                  onClick={goNext}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-thematic uppercase tracking-widest transition-all',
                    isLast
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
                      : 'btn-primary hover:bg-subtle'
                  )}
                >
                  {isLast ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> {t('game.tutorial.enter')}
                    </>
                  ) : (
                    <>
                      {t('game.tutorial.next')} <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Skip */}
              <button
                onClick={onSkip}
                className="w-full text-center text-ghost hover:text-muted text-xs font-mono uppercase tracking-widest transition-colors"
              >
                {t('game.tutorial.skip')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


