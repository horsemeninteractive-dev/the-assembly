import React, { useState } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { motion } from 'motion/react';
import { Check, Medal } from 'lucide-react';
import { User } from '../../../shared/types';
import { ACHIEVEMENT_DEFS } from '../../utils/achievements';
import { cn, apiUrl } from '../../utils/utils';

interface MedalsTabProps {
  user: User;
  token: string;
  onUpdateUser: (user: User) => void;
  playSound: (soundKey: string) => void;
}

export function MedalsTab({ user, token, onUpdateUser, playSound }: MedalsTabProps) {
  const { t } = useTranslation();
  const [pinnedAchievements, setPinnedAchievements] = useState<string[]>(
    user.pinnedAchievements ?? []
  );
  const [pinSaving, setPinSaving] = useState(false);

  const savePins = async (pins: string[]) => {
    setPinSaving(true);
    try {
      const res = await fetch(apiUrl('/api/achievements/pin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinnedAchievements: pins }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data.user);
      }
    } finally {
      setPinSaving(false);
    }
  };

  const togglePin = (id: string) => {
    playSound('click');
    let next: string[];
    if (pinnedAchievements.includes(id)) {
      next = pinnedAchievements.filter((p) => p !== id);
    } else if (pinnedAchievements.length < 3) {
      next = [...pinnedAchievements, id];
    } else {
      return; // already 3 pinned
    }
    setPinnedAchievements(next);
    savePins(next);
  };

  const TIER_COLOURS: Record<string, { badge: string; row: string }> = {
    Bronze: {
      badge: 'bg-amber-900/30 border-amber-700/50 text-amber-600',
      row: 'border-amber-700/20 hover:bg-amber-900/10',
    },
    Silver: {
      badge: 'bg-slate-800/40 border-slate-500/50 text-slate-300',
      row: 'border-slate-700/20 hover:bg-slate-800/20',
    },
    Gold: {
      badge: 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400',
      row: 'border-yellow-700/20 hover:bg-yellow-900/10',
    },
  };

  const earned = new Set<string>(
    (user.earnedAchievements ?? []).map((a: any) => (typeof a === 'string' ? a : a.id))
  );
  const earnedTotal = earned.size;
  const totalAchievements = ACHIEVEMENT_DEFS.length;
  const categories = ['Milestone', 'Role', 'Title', 'Gameplay'] as const;

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-4">
      {/* Summary header */}
      <div className="bg-elevated border border-subtle rounded-2xl p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-yellow-900/20 border border-yellow-700/40 flex items-center justify-center shrink-0">
          <Medal className="w-7 h-7 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted mb-1">
            {t('profile.medals.summary_title')}
          </div>
          <div className="text-xl font-thematic text-primary tracking-wide">
            {earnedTotal} <span className="text-faint text-sm">/ {totalAchievements}</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-card rounded-full overflow-hidden border border-subtle">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all"
              style={{
                width: `${Math.round((earnedTotal / totalAchievements) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-mono font-bold text-yellow-400">
            {Math.round((earnedTotal / totalAchievements) * 100)}%
          </div>
          <div className="text-[9px] font-mono text-faint uppercase tracking-widest">
            {t('profile.medals.summary_complete')}
          </div>
        </div>
      </div>

      {/* Pin hint */}
      <p className="text-[10px] font-mono text-faint text-center -mt-4">
        {t('profile.medals.pin_hint_desc')}&nbsp;
        {pinnedAchievements.length > 0
          ? t('profile.medals.pin_hint_status', { count: pinnedAchievements.length })
          : t('profile.medals.pin_hint_empty')}
        {pinSaving && <span className="text-yellow-400 ml-1">{t('profile.medals.saving')}</span>}
      </p>

      {/* Achievements by category */}
      {categories.map((cat) => {
        const defs = ACHIEVEMENT_DEFS.filter((a) => a.category === cat);
        return (
          <div key={cat}>
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted mb-3 border-b border-subtle pb-2">
              {t(`profile.medals.categories.${cat.toLowerCase()}`)}
            </div>
            <div className="space-y-2">
              {defs.map((def) => {
                const isEarned = earned.has(def.id);
                const isPinned = pinnedAchievements.includes(def.id);
                const tc = TIER_COLOURS[def.tier];
                return (
                  <motion.div
                    key={def.id}
                    onClick={() => isEarned && togglePin(def.id)}
                    whileHover={isEarned ? { scale: 1.01 } : {}}
                    whileTap={isEarned ? { scale: 0.99 } : {}}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all',
                      isEarned
                        ? cn('cursor-pointer', tc.row)
                        : 'border-subtle opacity-35 grayscale cursor-default',
                      isPinned && 'ring-1 ring-yellow-500/60'
                    )}
                  >
                    {/* Tier badge */}
                    <div
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest border shrink-0',
                        tc.badge
                      )}
                    >
                      {def.tier[0]}
                    </div>

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-primary tracking-wide uppercase">
                        {t(`profile.medals.list.${def.id}.name`)}
                      </div>
                      <div className="text-[10px] text-ghost leading-tight truncate">
                        {t(`profile.medals.list.${def.id}.desc`)}
                      </div>
                    </div>

                    {/* Rewards */}
                    <div className="text-[9px] font-mono text-faint shrink-0 text-right hidden sm:block">
                      <div>{t('profile.medals.xp_reward', { amount: def.xpReward })}</div>
                      <div>{t('profile.medals.cp_reward', { amount: def.cpReward })}</div>
                    </div>

                    {/* Pin indicator */}
                    {isEarned && (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all',
                          isPinned
                            ? 'bg-yellow-500 border-yellow-400'
                            : 'bg-card border-subtle'
                        )}
                      >
                        {isPinned && <Check className="w-3 h-3 text-black" />}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


