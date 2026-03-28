import { randomUUID } from 'crypto';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase.ts';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabaseAdmin.ts';
import { User, UserInternal, MatchSummary, SystemConfig } from '../src/types.ts';
import { logger } from './logger.ts';

// Use admin client if available, fallback to regular client
export const db = isSupabaseAdminConfigured ? supabaseAdmin : supabase;
export const isConfigured = isSupabaseAdminConfigured || isSupabaseConfigured;

if (!isConfigured) {
  logger.fatal(
    'CRITICAL: SUPABASE_URL is not configured! A temporary in-memory Map is being used as a fallback for the database. ALL user accounts, progression, cosmetics, and match history WILL BE SILENTLY DISCARDED upon server restart or crash. Configure Supabase variables immediately in production.'
  );
}

// In-memory fallback store (used when Supabase is not configured)
const users: Map<string, UserInternal> = new Map();
const memoryResetTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

import { stateClient, isRedisConfigured } from './redis.ts';

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Runtime Schema Validation (Zod)
// ---------------------------------------------------------------------------

const UserStatsSchema = z.object({
  gamesPlayed: z.number().default(0),
  wins: z.number().default(0),
  losses: z.number().default(0),
  civilGames: z.number().default(0),
  stateGames: z.number().default(0),
  overseerGames: z.number().default(0),
  kills: z.number().default(0),
  deaths: z.number().default(0),
  elo: z.number().default(1000),
  points: z.number().default(0),
  xp: z.number().default(0),
  agendasCompleted: z.number().default(0),
  civilWins: z.number().default(0),
  stateWins: z.number().default(0),
  overseerWins: z.number().default(0),
  rankedWins: z.number().default(0),
  rankedGames: z.number().default(0),
  casualWins: z.number().default(0),
  casualGames: z.number().default(0),
  classicWins: z.number().default(0),
  classicGames: z.number().default(0),
}).catchall(z.any());

export const SupabaseUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  stats: UserStatsSchema.nullable().default({}),
  owned_cosmetics: z.array(z.string()).nullable().default([]),
  active_frame: z.string().nullable().optional(),
  active_policy: z.string().nullable().optional(),
  active_vote: z.string().nullable().optional(),
  active_music: z.string().nullable().optional(),
  active_sound: z.string().nullable().optional(),
  active_background: z.string().nullable().optional(),
  cabinet_points: z.number().nullable().default(0),
  claimed_rewards: z.array(z.string()).nullable().default([]),
  earned_achievements: z.array(z.any()).nullable().default([]),
  pinned_achievements: z.array(z.string()).nullable().default([]),
  recently_played_with: z.array(z.any()).nullable().default([]),
  google_id: z.string().nullable().optional(),
  discord_id: z.string().nullable().optional(),
  is_admin: z.boolean().nullable().default(false),
  is_banned: z.boolean().nullable().default(false),
  token_version: z.number().nullable().default(0),
}).catchall(z.any());

export function mapSupabaseToUser(data: any): UserInternal | null {
  if (!data) return null;

  const result = SupabaseUserSchema.safeParse(data);
  if (!result.success) {
    logger.fatal({ 
      err: result.error.format(), 
      data, 
      msg: 'CRITICAL: mapSupabaseToUser failed validation. Possible Supabase schema drift detected!' 
    });
    return null;
  }

  const validData = result.data;

  // Convert nulls back to undefined for the internal UserInternal type
  return {
    id: validData.id,
    username: validData.username,
    password: validData.password ?? undefined,
    email: validData.email ?? undefined,
    stats: (validData.stats ?? {}) as any,
    createdAt: validData.created_at ?? undefined,
    avatarUrl: validData.avatar_url ?? undefined,
    ownedCosmetics: validData.owned_cosmetics ?? [],
    activeFrame: validData.active_frame ?? undefined,
    activePolicyStyle: validData.active_policy ?? undefined,
    activeVotingStyle: validData.active_vote ?? undefined,
    activeMusic: validData.active_music ?? undefined,
    activeSoundPack: validData.active_sound ?? undefined,
    activeBackground: validData.active_background ?? undefined,
    cabinetPoints: validData.cabinet_points ?? 0,
    claimedRewards: validData.claimed_rewards ?? [],
    earnedAchievements: (validData.earned_achievements ?? []) as any,
    pinnedAchievements: validData.pinned_achievements ?? [],
    recentlyPlayedWith: (validData.recently_played_with ?? []) as any,
    googleId: validData.google_id ?? undefined,
    discordId: validData.discord_id ?? undefined,
    isAdmin: !!validData.is_admin,
    isBanned: !!validData.is_banned,
    tokenVersion: validData.token_version ?? 0,
  };
}

function mapUserToSupabase(userData: UserInternal): Record<string, unknown> {
  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    password: userData.password,
    avatar_url: userData.avatarUrl,
    owned_cosmetics: userData.ownedCosmetics,
    active_frame: userData.activeFrame,
    active_policy: userData.activePolicyStyle,
    active_vote: userData.activeVotingStyle,
    active_music: userData.activeMusic,
    active_sound: userData.activeSoundPack,
    active_background: userData.activeBackground,
    cabinet_points: userData.cabinetPoints,
    claimed_rewards: userData.claimedRewards,
    earned_achievements: userData.earnedAchievements || [],
    pinned_achievements: userData.pinnedAchievements || [],
    recently_played_with: userData.recentlyPlayedWith || [],
    google_id: userData.googleId,
    discord_id: userData.discordId,
    is_admin: userData.isAdmin,
    is_banned: userData.isBanned,
    stats: userData.stats,
    token_version: userData.tokenVersion || 0,
  };
}

type LeaderboardMode = 'Overall' | 'Ranked' | 'Casual' | 'Classic';

export async function getLeaderboard(
  mode: LeaderboardMode = 'Overall',
  limit = 50,
  offset = 0
): Promise<UserInternal[]> {
  const safeLimit = Math.min(50, limit);
  const safeOffset = Math.max(0, offset);

  if (isConfigured) {
    const orderField =
      mode === 'Ranked'
        ? 'stats->elo'
        : mode === 'Casual'
          ? 'stats->casualWins'
          : mode === 'Classic'
            ? 'stats->classicWins'
            : 'stats->elo';

    const { data, error } = await db
      .from('users')
      .select('*')
      .order(orderField as any, { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) return [];
    return data
      .map(mapSupabaseToUser)
      .filter((u: UserInternal | null): u is UserInternal => u !== null);
  }
  const allUsers = Array.from(users.values());
  if (mode === 'Ranked')
    return allUsers
      .sort((a, b) => (b.stats.elo ?? 0) - (a.stats.elo ?? 0))
      .slice(safeOffset, safeOffset + safeLimit);
  if (mode === 'Casual')
    return allUsers
      .sort((a, b) => (b.stats.casualWins ?? 0) - (a.stats.casualWins ?? 0))
      .slice(safeOffset, safeOffset + safeLimit);
  if (mode === 'Classic')
    return allUsers
      .sort((a, b) => (b.stats.classicWins ?? 0) - (a.stats.classicWins ?? 0))
      .slice(safeOffset, safeOffset + safeLimit);
  return allUsers
    .sort((a, b) => (b.stats.elo ?? 0) - (a.stats.elo ?? 0))
    .slice(safeOffset, safeOffset + safeLimit);
}

export async function getAllLeaderboards(
  limit = 50,
  offset = 0
): Promise<{
  overall: any[];
  ranked: any[];
  casual: any[];
  classic: any[];
}> {
  const [overall, ranked, casual, classic] = await Promise.all([
    getLeaderboard('Overall', limit, offset),
    getLeaderboard('Ranked', limit, offset),
    getLeaderboard('Casual', limit, offset),
    getLeaderboard('Classic', limit, offset),
  ]);
  return { overall, ranked, casual, classic };
}

export async function getGlobalStats(): Promise<{ civilWins: number; stateWins: number }> {
  if (isConfigured) {
    const { data, error } = await db
      .from('global_stats')
      .select('civil_wins, state_wins')
      .eq('id', 1)
      .single();
    if (error || !data) return { civilWins: 0, stateWins: 0 };
    return { civilWins: data.civil_wins, stateWins: data.state_wins };
  }
  return { civilWins: 0, stateWins: 0 };
}

export async function incrementGlobalWin(faction: 'Civil' | 'State'): Promise<void> {
  if (isConfigured) {
    await db.rpc('increment_global_win', { faction });
  }
}

// ---------------------------------------------------------------------------
// System Config
// ---------------------------------------------------------------------------

export async function getSystemConfig(): Promise<SystemConfig> {
  const defaultConfig: SystemConfig = {
    maintenanceMode: false,
    xpMultiplier: 1.0,
    ipMultiplier: 1.0,
    minVersion: '0.9.0',
  };

  if (isConfigured) {
    const { data, error } = await db.from('system_config').select('*').eq('id', 1).single();
    if (error || !data) return defaultConfig;
    return {
      maintenanceMode: data.maintenance_mode,
      xpMultiplier: Number(data.xp_multiplier),
      ipMultiplier: Number(data.ip_multiplier),
      minVersion: data.min_version,
    };
  }
  return defaultConfig;
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const updated = { ...current, ...config };

  if (isConfigured) {
    await db
      .from('system_config')
      .update({
        maintenance_mode: updated.maintenanceMode,
        xp_multiplier: updated.xpMultiplier,
        ip_multiplier: updated.ipMultiplier,
        min_version: updated.minVersion,
      })
      .eq('id', 1);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function getUser(username: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await db.from('users').select('*').eq('username', username).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  return users.get(username) ?? null;
}

export async function getUserById(id: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await db.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.id === id) return u;
  }
  return null;
}

export async function getUserByGoogleId(googleId: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await db.from('users').select('*').eq('google_id', googleId).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.googleId === googleId) return u;
  }
  return null;
}

export async function getUserByDiscordId(discordId: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await db.from('users').select('*').eq('discord_id', discordId).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.discordId === discordId) return u;
  }
  return null;
}

export async function getUserByEmail(email: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await db.from('users').select('*').eq('email', email).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.email === email) return u;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Password Reset operations
// ---------------------------------------------------------------------------

export async function createPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  if (isRedisConfigured && stateClient) {
    const ttlSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttlSeconds > 0) {
      await stateClient.setex(`resetToken:${token}`, ttlSeconds, userId);
    }
  }

  if (isConfigured) {
    await db.from('password_resets').insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    });
  } else if (!isRedisConfigured) {
    memoryResetTokens.set(token, { userId, expiresAt });
  }
}

/** 
 * Verifies a token and returns the userId if valid.
 * This is SINGLE-USE: the token is deleted immediately from Redis/Memory, 
 * and although it persists in DB until the manual delete call, it's effectively verified once.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  // Check Redis first (preferred)
  if (isRedisConfigured && stateClient) {
    const userId = await stateClient.get(`resetToken:${token}`);
    if (userId) {
      await stateClient.del(`resetToken:${token}`);
      return userId;
    }
  }

  // Check Supabase
  if (isConfigured) {
    const { data, error } = await db
      .from('password_resets')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!error && data) {
      return data.user_id;
    }
  }

  // Check Memory fallback
  const mem = memoryResetTokens.get(token);
  if (mem) {
    memoryResetTokens.delete(token);
    if (mem.expiresAt > new Date()) {
      return mem.userId;
    }
  }

  return null;
}

export async function deletePasswordResetTokens(userId: string): Promise<void> {
  // In a real scenario, we'd need to find tokens by userId in Redis to delete them,
  // which requires a reverse lookup. For simplicity, we rely on the single-use
  // nature and TTL. Direct DB deletion still works.

  if (isConfigured) {
    await db.from('password_resets').delete().eq('user_id', userId);
  }

  // Clear memory fallback
  for (const [token, data] of memoryResetTokens.entries()) {
    if (data.userId === userId) memoryResetTokens.delete(token);
  }
}

// ---------------------------------------------------------------------------
// Friends operations
// ---------------------------------------------------------------------------

export async function getFriends(userId: string): Promise<UserInternal[]> {
  if (isConfigured) {
    const { data, error } = await db
      .from('friends')
      .select('*, user_id_1, user_id_2')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'accepted');
    if (error) return [];

    const friendIds = data.map((f: any) => (f.user_id_1 === userId ? f.user_id_2 : f.user_id_1));
    const { data: friendsData, error: friendsError } = await db
      .from('users')
      .select('*')
      .in('id', friendIds);
    if (friendsError) return [];
    return friendsData
      .map(mapSupabaseToUser)
      .filter((u: UserInternal | null): u is UserInternal => u !== null);
  }
  return [];
}

export async function sendFriendRequest(userId1: string, userId2: string): Promise<void> {
  if (isConfigured) {
    await db.from('friends').insert({ user_id_1: userId1, user_id_2: userId2, status: 'pending' });
  }
}

export async function acceptFriendRequest(userId1: string, userId2: string): Promise<void> {
  if (isConfigured) {
    await db
      .from('friends')
      .update({ status: 'accepted' })
      .or(
        `and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_2.eq.${userId1})`
      );
  }
}

export async function isFriend(userId1: string, userId2: string): Promise<boolean> {
  if (isConfigured) {
    const { data, error } = await db
      .from('friends')
      .select('*')
      .or(
        `and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_2.eq.${userId1})`
      )
      .eq('status', 'accepted')
      .single();
    return !error && !!data;
  }
  return false;
}

export async function removeFriend(userId1: string, userId2: string): Promise<void> {
  if (isConfigured) {
    await db
      .from('friends')
      .delete()
      .or(
        `and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_1.eq.${userId1})`
      );
  }
}

export async function searchUsers(
  query: string,
  currentUserId: string,
  limit = 10
): Promise<UserInternal[]> {
  if (!query.trim()) return [];

  // Validate if query is a UUID to avoid Postgres errors
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    query.trim()
  );

  if (isConfigured) {
    // Simplify for debugging: search by username only first
    const { data, error } = await db
      .from('users')
      .select('*')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(limit);

    if (error) return [];
    return (data || [])
      .map(mapSupabaseToUser)
      .filter((u: UserInternal | null): u is UserInternal => u !== null);
  }

  const results = Array.from(users.values())
    .filter(
      (u) =>
        u.id !== currentUserId &&
        (u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.id === query ||
          (u as any).email?.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, limit);

  console.log(`[AdminSearch-Fallback] Found ${results.length} results for "${query}"`);
  return results;
}

export async function getPendingFriendRequests(userId: string): Promise<UserInternal[]> {
  if (isConfigured) {
    const { data, error } = await db
      .from('friends')
      .select('user_id_1')
      .eq('user_id_2', userId)
      .eq('status', 'pending');
    if (error || !data || data.length === 0) return [];
    const senderIds = (data as Array<{ user_id_1: string }>).map((r) => r.user_id_1);
    const { data: senders, error: sendersError } = await db
      .from('users')
      .select('*')
      .in('id', senderIds);
    return senders
      .map(mapSupabaseToUser)
      .filter((u: UserInternal | null): u is UserInternal => u !== null);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function saveUser(userData: UserInternal): Promise<void> {
  if (isConfigured) {
    const { error } = await db.from('users').upsert(mapUserToSupabase(userData));
    if (error) {
      console.error('Supabase Save Error:', JSON.stringify(error, null, 2));
    }
  } else {
    users.set(userData.username, userData);
  }
}

// ---------------------------------------------------------------------------
// Match history
// ---------------------------------------------------------------------------

const matchHistoryStore: Map<string, MatchSummary[]> = new Map();

export async function saveMatchResult(
  match: Omit<MatchSummary, 'id'> & { id: string }
): Promise<void> {
  if (isConfigured) {
    const { error } = await db.from('match_history').insert({
      id: match.id,
      user_id: match.userId,
      played_at: match.playedAt,
      room_name: match.roomName,
      mode: match.mode,
      player_count: match.playerCount,
      role: match.role,
      won: match.won,
      win_reason: match.winReason,
      rounds: match.rounds,
      civil_directives: match.civilDirectives,
      state_directives: match.stateDirectives,
      agenda_id: match.agendaId ?? null,
      agenda_name: match.agendaName ?? null,
      agenda_completed: match.agendaCompleted,
      xp_earned: match.xpEarned,
      ip_earned: match.ipEarned,
      cp_earned: match.cpEarned,
    });
    if (error) console.error('Match history save error:', error.message);
  } else {
    const existing = matchHistoryStore.get(match.userId) ?? [];
    existing.unshift(match as any);
    matchHistoryStore.set(match.userId, existing.slice(0, 50));
  }
}

export async function getMatchHistory(
  userId: string,
  limit = 20,
  offset = 0
): Promise<MatchSummary[]> {
  const safeLimit = Math.min(50, limit);
  const safeOffset = Math.max(0, offset);

  if (isConfigured) {
    const { data, error } = await db
      .from('match_history')
      .select('*')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      playedAt: r.played_at,
      roomName: r.room_name,
      mode: r.mode,
      playerCount: r.player_count,
      role: r.role,
      won: r.won,
      winReason: r.win_reason,
      rounds: r.rounds,
      civilDirectives: r.civil_directives,
      stateDirectives: r.state_directives,
      agendaId: r.agenda_id,
      agendaName: r.agenda_name,
      agendaCompleted: r.agenda_completed,
      xpEarned: r.xp_earned,
      ipEarned: r.ip_earned,
      cpEarned: r.cp_earned,
    }));
  }
  return (matchHistoryStore.get(userId) ?? []).slice(0, limit);
}

// ---------------------------------------------------------------------------
// New-user factory
// ---------------------------------------------------------------------------

export function makeNewUser(overrides: Partial<UserInternal> = {}): UserInternal {
  return {
    id: randomUUID(),
    username: '',
    avatarUrl: undefined,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      civilGames: 0,
      stateGames: 0,
      overseerGames: 0,
      kills: 0,
      deaths: 0,
      elo: 1000,
      points: 0,
      xp: 0,
      agendasCompleted: 0,
      civilWins: 0,
      stateWins: 0,
      overseerWins: 0,
      rankedWins: 0,
      rankedGames: 0,
      casualWins: 0,
      casualGames: 0,
      classicWins: 0,
      classicGames: 0,
    },
    cabinetPoints: 0,
    claimedRewards: [],
    earnedAchievements: [],
    pinnedAchievements: [],
    recentlyPlayedWith: [],
    ownedCosmetics: ['music-ambient'],
    tokenVersion: 0,
    ...overrides,
  };
}
