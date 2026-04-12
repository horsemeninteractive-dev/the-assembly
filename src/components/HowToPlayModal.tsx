import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Scale, Eye, Crown, Vote, Zap, Target, FileText } from 'lucide-react';
import { OverseerIcon } from './icons';
import { useTranslation } from '../contexts/I18nContext';
import { cn } from '../utils/utils';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'overview' | 'roles' | 'loop' | 'titles' | 'agendas' | 'tips';

const TabContent: React.FC<{ tab: TabId }> = ({ tab }) => {
  const { t } = useTranslation();
  if (tab === 'overview')
    return (
      <div className="space-y-4">
        <p className="text-secondary leading-relaxed text-sm">
          {t('game.how_to_play.overview.p1', {
            social_deduction_game: <strong className="text-primary">social deduction game</strong>,
          })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-900/15 border border-blue-500/20 rounded-xl p-3">
            <div className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-1">
              {t('game.how_to_play.overview.civil_wins_label')}
            </div>
            <ul className="text-tertiary text-xs space-y-1">
              {t('game.how_to_play.overview.civil_wins', { returnObjects: true }).map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="bg-red-900/15 border border-red-500/20 rounded-xl p-3">
            <div className="text-red-400 font-bold text-xs uppercase tracking-widest mb-1">
              {t('game.how_to_play.overview.state_wins_label')}
            </div>
            <ul className="text-tertiary text-xs space-y-1">
              {t('game.how_to_play.overview.state_wins', { returnObjects: true }).map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="bg-surface-glass border border-default rounded-xl p-4 space-y-3 backdrop-blur-md">
          <div className="text-orange-400 text-xs font-mono uppercase tracking-widest border-b border-orange-500/20 pb-1.5 mb-2">
            {t('game.how_to_play.overview.crisis_label')}
          </div>
          <p className="text-tertiary text-xs leading-relaxed">
            {t('game.how_to_play.overview.crisis_desc', {
              event_cards: <span className="text-primary font-bold">Event Cards</span>,
            })}
          </p>
        </div>
        <div className="bg-surface border border-default rounded-xl p-4 space-y-3">
          <div className="text-muted text-xs font-mono uppercase tracking-widest">
            {t('game.how_to_play.overview.deck_label')}
          </div>
          <p className="text-tertiary text-sm">
            {t('game.how_to_play.overview.deck_desc', {
              civil_count: <span className="text-blue-400">6 Civil</span>,
              state_count: <span className="text-red-400">11 State</span>,
            })}
          </p>
        </div>
        <div className="bg-surface border border-default rounded-xl p-4 space-y-2">
          <div className="text-muted text-xs font-mono uppercase tracking-widest">
            {t('game.how_to_play.overview.tracker_label')}
          </div>
          <p className="text-tertiary text-sm">
            {t('game.how_to_play.overview.tracker_desc', {
              chaos_policy: <span className="text-orange-400">chaos policy</span>,
            })}
          </p>
        </div>
      </div>
    );

  if (tab === 'roles')
    return (
      <div className="space-y-3">
        <div className="bg-blue-900/15 border border-blue-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-blue-400" />
            <div className="text-blue-400 font-bold uppercase tracking-wider text-sm">
              {t('game.how_to_play.roles_tab.civil.label')}
            </div>
          </div>
          <p className="text-tertiary text-sm leading-relaxed">
            {t('game.how_to_play.roles_tab.civil.desc')}
          </p>
        </div>
        <div className="bg-red-900/15 border border-red-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-red-400" />
            <div className="text-red-400 font-bold uppercase tracking-wider text-sm">
              {t('game.how_to_play.roles_tab.state.label')}
            </div>
          </div>
          <p className="text-tertiary text-sm leading-relaxed">
            {t('game.how_to_play.roles_tab.state.desc')}
          </p>
        </div>
        <div className="bg-red-900/25 border border-red-600/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <OverseerIcon className="w-5 h-5 text-red-500" />
            <div className="text-red-500 font-bold uppercase tracking-wider text-sm">
              {t('game.how_to_play.roles_tab.overseer.label')}
            </div>
          </div>
          <p className="text-tertiary text-sm leading-relaxed">
            {t('game.how_to_play.roles_tab.overseer.desc')}
          </p>
          <p className="text-faint text-xs italic mt-2">
            {t('game.how_to_play.roles_tab.overseer.distribution_hint')}
          </p>
        </div>
        <div className="bg-surface border border-default rounded-xl p-3">
          <div className="text-muted text-xs font-mono uppercase tracking-widest mb-2">
            {t('game.how_to_play.roles_tab.distribution_label')}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            {[
              ['5p', '3C', '1S+O'],
              ['6p', '4C', '1S+O'],
              ['7p', '4C', '2S+O'],
              ['8p', '5C', '2S+O'],
              ['9p', '5C', '3S+O'],
              ['10p', '6C', '3S+O'],
            ].map(([players, civil, state]) => (
              <div key={players} className="bg-card rounded-lg p-2">
                <div className="text-muted mb-1">{players}</div>
                <div className="text-blue-400">{civil}</div>
                <div className="text-red-400">{state}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  if (tab === 'loop')
    return (
      <div className="space-y-3">
        {[
          {
            num: '1',
            label: t('game.how_to_play.loop_tab.step_1.label'),
            color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
            desc: t('game.how_to_play.loop_tab.step_1.desc'),
          },
          {
            num: '2',
            label: t('game.how_to_play.loop_tab.step_2.label'),
            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
            desc: t('game.how_to_play.loop_tab.step_2.desc'),
          },
          {
            num: '3',
            label: t('game.how_to_play.loop_tab.step_3.label'),
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            desc: t('game.how_to_play.loop_tab.step_3.desc'),
          },
          {
            num: '4',
            label: t('game.how_to_play.loop_tab.step_4.label'),
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            desc: t('game.how_to_play.loop_tab.step_4.desc'),
          },
          {
            num: '5',
            label: t('game.how_to_play.loop_tab.step_5.label'),
            color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            desc: t('game.how_to_play.loop_tab.step_5.desc'),
          },
        ].map((step) => (
          <div key={step.num} className={cn('rounded-xl p-3 border', step.color)}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs font-bold">{step.num}</span>
              </div>
              <span className="font-medium text-sm">{step.label}</span>
            </div>
            <p className="text-tertiary text-xs leading-relaxed pl-7">{step.desc}</p>
          </div>
        ))}
      </div>
    );

  if (tab === 'titles')
    return (
      <div className="space-y-3">
        <p className="text-tertiary text-sm leading-relaxed">
          {t('game.how_to_play.titles_tab.intro')}
        </p>
        {Object.entries(t('game.how_to_play.titles_tab.roles', { returnObjects: true })).map(
          ([key, role]: [string, any]) => (
            <div key={key} className="bg-surface border border-default rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-yellow-400 font-bold text-sm">{role.name}</div>
                <div className="text-faint text-[10px] font-mono uppercase tracking-widest shrink-0">
                  {role.when}
                </div>
              </div>
              <p className="text-tertiary text-xs leading-relaxed">{role.desc}</p>
            </div>
          )
        )}
      </div>
    );

  if (tab === 'agendas')
    return (
      <div className="space-y-4">
        <p className="text-secondary text-sm leading-relaxed">
          {t('game.how_to_play.agendas_tab.p1', {
            personal_agenda: <span className="text-emerald-400 font-medium">Personal Agenda</span>,
            xp_bonus: <strong className="text-primary">+100 XP and bonus IP</strong>,
          })}
        </p>
        <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
          <div className="text-emerald-400 text-xs font-mono uppercase tracking-widest">
            {t('game.how_to_play.agendas_tab.list_label')}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(t('game.how_to_play.agendas_tab.agendas', { returnObjects: true })).map(
              ([key, agenda]: [string, any]) => (
                <div key={key} className="flex gap-2 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 shrink-0 mt-1.5" />
                  <div>
                    <span className="text-primary text-xs font-medium">{agenda.name}</span>
                    <span className="text-faint text-xs"> — {agenda.desc}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );

  if (tab === 'tips')
    return (
      <div className="space-y-3">
        {[
          {
            faction: t('game.how_to_play.tips_tab.civil.label'),
            color: 'text-blue-400',
            bg: 'bg-blue-900/10 border-blue-500/20',
            tips: t('game.how_to_play.tips_tab.civil.tips', { returnObjects: true }),
          },
          {
            faction: t('game.how_to_play.tips_tab.state.label'),
            color: 'text-red-400',
            bg: 'bg-red-900/10 border-red-500/20',
            tips: t('game.how_to_play.tips_tab.state.tips', { returnObjects: true }),
          },
          {
            faction: t('game.how_to_play.tips_tab.general.label'),
            color: 'text-secondary',
            bg: 'bg-surface border-default',
            tips: t('game.how_to_play.tips_tab.general.tips', { returnObjects: true }),
          },
        ].map((section) => (
          <div key={section.faction} className={cn('rounded-xl p-4 border', section.bg)}>
            <div className={cn('font-bold text-sm mb-2 uppercase tracking-wider', section.color)}>
              {section.faction}
            </div>
            <ul className="space-y-1.5">
              {section.tips.map((tip: string, i: number) => (
                <li key={i} className="flex gap-2 items-start text-tertiary text-xs leading-relaxed">
                  <span className="text-faint shrink-0 mt-0.5">—</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );

  return null;
};

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: t('game.how_to_play.tabs.overview'),
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    { id: 'roles', label: t('game.how_to_play.tabs.roles'), icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'loop', label: t('game.how_to_play.tabs.loop'), icon: <Crown className="w-3.5 h-3.5" /> },
    {
      id: 'titles',
      label: t('game.how_to_play.tabs.titles'),
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      id: 'agendas',
      label: t('game.how_to_play.tabs.agendas'),
      icon: <Target className="w-3.5 h-3.5" />,
    },
    { id: 'tips', label: t('game.how_to_play.tabs.tips'), icon: <Vote className="w-3.5 h-3.5" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-backdrop backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl flex flex-col backdrop-blur-2xl"
            style={{ maxHeight: '88dvh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-subtle shrink-0">
              <div>
                <h2 className="text-lg font-thematic text-primary tracking-wide uppercase">
                  {t('game.how_to_play.title')}
                </h2>
                <p className="text-faint text-xs font-mono">
                  The Assembly — {t('game.how_to_play.subtitle')}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close Rules Reference"
                className="text-ghost hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab grid - 2 rows of 3 */}
            <div className="grid grid-cols-3 gap-1 border-b border-subtle shrink-0 px-4 pt-3 pb-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 px-2 py-2 rounded-t-lg text-xs font-mono uppercase tracking-widest transition-all',
                    activeTab === tab.id
                      ? 'bg-surface text-primary border-t border-l border-r border-default'
                      : 'text-faint hover:text-tertiary'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <TabContent tab={activeTab} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-subtle shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-card text-primary rounded-xl hover:bg-hover transition-all font-thematic text-sm uppercase tracking-widest border border-default"
              >
                {t('game.how_to_play.back_to_lobby')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


