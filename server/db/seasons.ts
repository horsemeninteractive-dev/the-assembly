import { adminDb, withRetry } from './core';
import { SeasonSnapshot } from '../../shared/types';
import { logger } from '../logger';

export async function createSeasonSnapshot(snapshot: Omit<SeasonSnapshot, 'id' | 'createdAt'>): Promise<void> {
  await withRetry(async () => {
    const { error } = await adminDb.from('season_snapshots').insert({
      user_id: snapshot.userId,
      season_period: snapshot.seasonPeriod,
      elo_at_end: snapshot.eloAtEnd,
      peak_elo: snapshot.peakElo,
      ranked_wins: snapshot.rankedWins,
      ranked_games: snapshot.rankedGames,
      rank_tier: snapshot.rankTier,
      rewards_claimed: snapshot.rewardsClaimed,
    });
    if (error) throw error;
  }, 'createSeasonSnapshot');
}

export async function getSeasonLeaderboard(seasonPeriod: string, limit = 50, offset = 0): Promise<any[]> {
  const safeLimit = Math.min(100, limit);
  const safeOffset = Math.max(0, offset);

  return await withRetry(async () => {
    const { data, error } = await adminDb
      .from('season_snapshots')
      .select('*, users!inner(username, avatar_url, active_frame)')
      .eq('season_period', seasonPeriod)
      .order('elo_at_end', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);
    
    if (error) throw error;

    return (data || []).map(row => ({
      userId: row.user_id,
      username: (row.users as any).username,
      avatarUrl: (row.users as any).avatar_url,
      activeFrame: (row.users as any).active_frame,
      elo: row.elo_at_end,
      peakElo: row.peak_elo,
      rankTier: row.rank_tier,
      rankedWins: row.ranked_wins,
      rankedGames: row.ranked_games,
      seasonPeriod: row.season_period,
    }));
  }, 'getSeasonLeaderboard').catch(() => []);
}

export async function getUserSeasonSnapshots(userId: string): Promise<SeasonSnapshot[]> {
  return await withRetry(async () => {
    const { data, error } = await adminDb
      .from('season_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      seasonPeriod: row.season_period,
      eloAtEnd: row.elo_at_end,
      peakElo: row.peak_elo,
      rankedWins: row.ranked_wins,
      rankedGames: row.ranked_games,
      rankTier: row.rank_tier,
      rewardsClaimed: row.rewards_claimed,
      createdAt: row.created_at,
    }));
  }, 'getUserSeasonSnapshots').catch(() => []);
}

export async function claimSeasonRewards(userId: string, seasonPeriod: string): Promise<boolean> {
  return await withRetry(async () => {
    const { data, error } = await adminDb
      .from('season_snapshots')
      .update({ rewards_claimed: true })
      .match({ user_id: userId, season_period: seasonPeriod, rewards_claimed: false })
      .select();
    
    if (error) throw error;
    return !!data && data.length > 0;
  }, 'claimSeasonRewards');
}
