/**
 * server/game/clanChallenges.ts
 *
 * Collaborative challenge definitions and evaluation for clans.
 * All members contribute to these progress increments.
 */

import { ChallengeId, GameState, Player, ActiveChallenge, ClanChallengeData } from '../../shared/types';
import { 
  getCurrentDayPeriod, 
  getCurrentWeekPeriod, 
  getCurrentSeasonPeriod,
  getDailyResetsAt,
  getWeeklyResetsAt,
  getSeasonEndsAt
} from './challenges';

export interface ClanChallengeContext {
  s: GameState;
  p: Player;
  won: boolean;
  agendaCompleted: boolean;
}

/**
 * Calculates base clan XP rewarded for simply playing a match.
 */
export const calculateClanXpGain = (ctx: ClanChallengeContext): number => {
  let xp = 20; // Base for playing
  if (ctx.won) xp += 30; // Extra for win
  return xp;
};

export interface ClanChallengeDef {
  id: ChallengeId;
  tier: 'Daily' | 'Weekly' | 'Seasonal';
  name: string;
  description: string;
  icon: string;
  target: number;
  xpReward: number; // Given to the clan itself
  evaluate(ctx: ClanChallengeContext): number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function totalDirectives(s: GameState): number {
  return s.civilDirectives + s.stateDirectives;
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

const DAILY: ClanChallengeDef[] = [
  {
    id: 'clan_daily_play',
    tier: 'Daily',
    name: 'Unified Effort',
    description: 'Play 5 games as a clan (total member games).',
    icon: 'Gamepad2',
    target: 5,
    xpReward: 500,
    evaluate: () => 1,
  },
  {
    id: 'clan_daily_win',
    tier: 'Daily',
    name: 'Shared Victory',
    description: 'Secure 2 wins across the clan.',
    icon: 'Trophy',
    target: 2,
    xpReward: 800,
    evaluate: ({ won }) => won ? 1 : 0,
  },
  {
    id: 'clan_daily_directives',
    tier: 'Daily',
    name: 'Legislative Momentum',
    description: 'Enact 10 directives total.',
    icon: 'FileText',
    target: 10,
    xpReward: 600,
    evaluate: ({ s }) => totalDirectives(s),
  },
  {
    id: 'clan_daily_agendas',
    tier: 'Daily',
    name: 'Strategic Focus',
    description: 'Complete 3 personal agendas across the clan.',
    icon: 'Target',
    target: 3,
    xpReward: 700,
    evaluate: ({ agendaCompleted }) => agendaCompleted ? 1 : 0,
  },
];

const WEEKLY: ClanChallengeDef[] = [
  {
    id: 'clan_weekly_play',
    tier: 'Weekly',
    name: 'Dominant Presence',
    description: 'Play 25 games as a clan.',
    icon: 'Layers',
    target: 25,
    xpReward: 2500,
    evaluate: () => 1,
  },
  {
    id: 'clan_weekly_win',
    tier: 'Weekly',
    name: 'Unstoppable Force',
    description: 'Secure 10 wins across the clan.',
    icon: 'Trophy',
    target: 10,
    xpReward: 4000,
    evaluate: ({ won }) => won ? 1 : 0,
  },
  {
    id: 'clan_weekly_directives',
    tier: 'Weekly',
    name: 'Supreme Council',
    description: 'Enact 50 directives total.',
    icon: 'FileCheck',
    target: 50,
    xpReward: 3000,
    evaluate: ({ s }) => totalDirectives(s),
  },
];

const SEASONAL: ClanChallengeDef[] = [
  {
    id: 'clan_seasonal_play',
    tier: 'Seasonal',
    name: 'Eternal Assembly',
    description: 'Play 100 games this season.',
    icon: 'Gamepad2',
    target: 100,
    xpReward: 10000,
    evaluate: () => 1,
  },
  {
    id: 'clan_seasonal_win',
    tier: 'Seasonal',
    name: 'Seasoned Conquerors',
    description: 'Secure 40 wins this season.',
    icon: 'Trophy',
    target: 40,
    xpReward: 15000,
    evaluate: ({ won }) => won ? 1 : 0,
  },
];

export const CLAN_CHALLENGE_MAP = new Map<ChallengeId, ClanChallengeDef>([
  ...DAILY.map(d => [d.id, d] as [string, ClanChallengeDef]),
  ...WEEKLY.map(d => [d.id, d] as [string, ClanChallengeDef]),
  ...SEASONAL.map(d => [d.id, d] as [string, ClanChallengeDef]),
]);

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

export function assignClanChallenges(): ClanChallengeData {
  const today = getCurrentDayPeriod();
  const thisWeek = getCurrentWeekPeriod();
  const thisSeason = getCurrentSeasonPeriod();

  return {
    daily: pickRandom(DAILY, 3).map(def => ({ id: def.id, progress: 0, completed: false })),
    weekly: pickRandom(WEEKLY, 2).map(def => ({ id: def.id, progress: 0, completed: false })),
    seasonal: pickRandom(SEASONAL, 1).map(def => ({ id: def.id, progress: 0, completed: false })),
    dailyPeriod: today,
    weeklyPeriod: thisWeek,
    seasonPeriod: thisSeason,
    dailyResetsAt: getDailyResetsAt(),
    weeklyResetsAt: getWeeklyResetsAt(),
    seasonEndsAt: getSeasonEndsAt(),
  };
}

export function refreshClanChallenges(existing: ClanChallengeData | undefined): ClanChallengeData {
  const today = getCurrentDayPeriod();
  const thisWeek = getCurrentWeekPeriod();
  const thisSeason = getCurrentSeasonPeriod();

  if (!existing) return assignClanChallenges();

  const needsDaily = existing.dailyPeriod !== today;
  const needsWeekly = existing.weeklyPeriod !== thisWeek;
  const needsSeasonal = existing.seasonPeriod !== thisSeason;

  return {
    daily: needsDaily ? pickRandom(DAILY, 3).map(def => ({ id: def.id, progress: 0, completed: false })) : existing.daily,
    weekly: needsWeekly ? pickRandom(WEEKLY, 2).map(def => ({ id: def.id, progress: 0, completed: false })) : existing.weekly,
    seasonal: needsSeasonal ? pickRandom(SEASONAL, 1).map(def => ({ id: def.id, progress: 0, completed: false })) : existing.seasonal,
    dailyPeriod: today,
    weeklyPeriod: thisWeek,
    seasonPeriod: thisSeason,
    dailyResetsAt: getDailyResetsAt(),
    weeklyResetsAt: getWeeklyResetsAt(),
    seasonEndsAt: getSeasonEndsAt(),
  };
}

export function evaluateClanChallenges(
  data: ClanChallengeData,
  ctx: ClanChallengeContext
): { updated: ClanChallengeData; xpReward: number; completedIds: ChallengeId[] } {
  let xpReward = 0;
  const completedIds: ChallengeId[] = [];
  const now = new Date().toISOString();

  function progress(list: ActiveChallenge[]): ActiveChallenge[] {
    return list.map(active => {
      if (active.completed) return active;
      const def = CLAN_CHALLENGE_MAP.get(active.id);
      if (!def) return active;

      const increment = def.evaluate(ctx);
      if (increment <= 0) return active;

      const newProgress = Math.min(def.target, active.progress + increment);
      const nowComplete = newProgress >= def.target;

      if (nowComplete && !active.completed) {
        xpReward += def.xpReward;
        completedIds.push(def.id);
      }

      return {
        ...active,
        progress: newProgress,
        completed: nowComplete,
        completedAt: nowComplete ? now : active.completedAt,
      };
    });
  }

  return {
    updated: {
      ...data,
      daily: progress(data.daily),
      weekly: progress(data.weekly),
      seasonal: progress(data.seasonal),
    },
    xpReward,
    completedIds,
  };
}

/** Prepares a detailed response for the UI by attaching names/icons/targets to raw progress IDs. */
export function enrichClanChallenges(data: ClanChallengeData) {
  const enrich = (list: ActiveChallenge[]) => list.map(active => {
    const def = CLAN_CHALLENGE_MAP.get(active.id);
    return {
      ...active,
      name: def?.name ?? 'Unknown',
      description: def?.description ?? '',
      icon: def?.icon ?? 'Shield',
      target: def?.target ?? 0,
      xpReward: def?.xpReward ?? 0,
      ipReward: 0,
      tier: def?.tier ?? 'Daily'
    };
  });

  return {
    daily: enrich(data.daily),
    weekly: enrich(data.weekly),
    seasonal: enrich(data.seasonal),
    dailyResetsAt: data.dailyResetsAt,
    weeklyResetsAt: data.weeklyResetsAt,
    seasonEndsAt: data.seasonEndsAt,
  };
}
