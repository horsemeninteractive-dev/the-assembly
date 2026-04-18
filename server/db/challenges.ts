/**
 * server/db/challenges.ts
 *
 * Persistence for per-user challenge progress.
 * Stored as a JSONB column `challenges_data` on the users table.
 *
 * Required Supabase migration:
 *   ALTER TABLE users ADD COLUMN IF NOT EXISTS challenges_data jsonb;
 */

import { UserChallengeData, ChallengesResponse, EnrichedChallenge } from '../../shared/types';
import { UserInternal } from '../../shared/types';
import { adminDb, isConfigured, withRetry } from './core';
import { logger } from '../logger';
import {
  getCurrentDayPeriod,
  getCurrentWeekPeriod,
  getCurrentSeasonPeriod,
  getDailyResetsAt,
  getWeeklyResetsAt,
  getSeasonEndsAt,
  assignDailyChallenges,
  assignWeeklyChallenges,
  assignSeasonalChallenges,
  CHALLENGE_MAP,
} from '../game/challenges';

// ---------------------------------------------------------------------------
// Refresh logic — called on GET /api/challenges and before evaluation
// ---------------------------------------------------------------------------

/**
 * Ensures a user's challenges are up to date for the current periods.
 * - Reassigns daily if the day has rolled over
 * - Reassigns weekly if the week has rolled over
 * - Assigns seasonal only if the season has changed (preserves progress within a season)
 * Returns the (potentially updated) challenge data. Does NOT persist — caller must saveUser.
 */
export function refreshChallenges(user: UserInternal, currentConfig?: import('../../shared/types').SystemConfig): UserChallengeData {
  const existing = user.challengeData;
  const today = getCurrentDayPeriod();
  const thisWeek = getCurrentWeekPeriod();
  const thisSeason = currentConfig ? currentConfig.currentSeasonPeriod : getCurrentSeasonPeriod();

  const needsDaily = !existing || existing.dailyPeriod !== today;
  const needsWeekly = !existing || existing.weeklyPeriod !== thisWeek;
  const needsSeasonal = !existing || existing.seasonPeriod !== thisSeason;

  return {
    daily: needsDaily ? assignDailyChallenges() : existing!.daily,
    weekly: needsWeekly ? assignWeeklyChallenges() : existing!.weekly,
    seasonal: needsSeasonal ? assignSeasonalChallenges() : (existing!.seasonal?.length ? existing!.seasonal : assignSeasonalChallenges()),
    dailyPeriod: today,
    weeklyPeriod: thisWeek,
    seasonPeriod: thisSeason,
    dailyResetsAt: getDailyResetsAt(),
    weeklyResetsAt: getWeeklyResetsAt(),
    seasonEndsAt: currentConfig ? currentConfig.currentSeasonEndsAt : getSeasonEndsAt(),
  };
}

// ---------------------------------------------------------------------------
// Load/save from Supabase
// ---------------------------------------------------------------------------

export async function loadChallengeData(userId: string): Promise<UserChallengeData | null> {
  if (!isConfigured) return null;
  try {
    const { data, error } = await adminDb
      .from('users')
      .select('challenges_data')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return (data as any).challenges_data as UserChallengeData | null;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to load challenge data');
    return null;
  }
}

export async function saveChallengeData(userId: string, data: UserChallengeData): Promise<void> {
  if (!isConfigured) return;
  await withRetry(async () => {
    const { error } = await adminDb
      .from('users')
      .update({ challenges_data: data })
      .eq('id', userId);
    if (error) throw error;
  }, 'saveChallengeData');
}

// ---------------------------------------------------------------------------
// Build the enriched response for the API
// ---------------------------------------------------------------------------

export function buildChallengesResponse(data: UserChallengeData, overrideSeasonEndsAt?: string): ChallengesResponse {
  function enrich(active: import('../../shared/types').ActiveChallenge): EnrichedChallenge | null {
    const def = CHALLENGE_MAP.get(active.id);
    if (!def) return null;
    return {
      id: active.id,
      tier: def.tier,
      name: def.name,
      description: def.description,
      icon: def.icon,
      target: def.target,
      progress: active.progress,
      completed: active.completed,
      completedAt: active.completedAt,
      xpReward: def.xpReward,
      ipReward: def.ipReward,
    };
  }

  const dailyResetsAt = getDailyResetsAt();
  const weeklyResetsAt = getWeeklyResetsAt();
  const seasonEndsAt = overrideSeasonEndsAt || getSeasonEndsAt();

  return {
    daily: data.daily.map(enrich).filter((c): c is EnrichedChallenge => c !== null),
    weekly: data.weekly.map(enrich).filter((c): c is EnrichedChallenge => c !== null),
    seasonal: (data.seasonal ?? []).map(enrich).filter((c): c is EnrichedChallenge => c !== null),
    dailyResetsAt,
    weeklyResetsAt,
    seasonEndsAt,
  };
}
