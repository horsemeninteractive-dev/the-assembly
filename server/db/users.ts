import { z } from 'zod';
import { randomUUID } from 'crypto';
import { adminDb, isConfigured, withRetry } from './core';
import { UserInternal, ClanBadge } from '../../shared/types';
import { logger } from '../logger';
import { stateClient, isRedisConfigured } from '../redis';

export const users: Map<string, UserInternal> = new Map();
export const memoryResetTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

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
  crisisWins: z.number().default(0),
  crisisGames: z.number().default(0),
  bettingWins: z.number().default(0),
  bettingPoints: z.number().default(0),
}).catchall(z.any());

export const SupabaseUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  stats: UserStatsSchema.nullable().default({} as any),
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
  challenges_data: z.any().nullable().optional(),
  referral_code: z.string().nullable().optional(),
  referred_by: z.string().nullable().optional(),
  referral_processed: z.boolean().nullable().default(false),
  last_login_at: z.string().nullable().optional(),
  login_streak: z.number().nullable().default(0),
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
    challengeData: (validData.challenges_data ?? undefined) as any,
    referralCode: validData.referral_code ?? undefined,
    referredBy: validData.referred_by ?? undefined,
    referralProcessed: !!validData.referral_processed,
    lastLoginAt: validData.last_login_at ?? undefined,
    loginStreak: validData.login_streak ?? 0,
    // Clan badge — populated when the query joins the clans table via clan_id
    clan: data.clans
      ? ({
          id: data.clans.id,
          tag: data.clans.tag,
          name: data.clans.name,
          emblem: {
            iconId: data.clans.emblem_icon_id ?? 'Shield',
            iconColor: data.clans.emblem_icon_color ?? '#FFFFFF',
            bgColor: data.clans.emblem_bg_color ?? '#2A2A2A',
          },
        } as ClanBadge)
      : undefined,
  };
}

export function mapUserToSupabase(userData: UserInternal): Record<string, unknown> {
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
    challenges_data: userData.challengeData ?? null,
    referral_code: userData.referralCode,
    referred_by: userData.referredBy,
    referral_processed: userData.referralProcessed,
    last_login_at: userData.lastLoginAt,
    login_streak: userData.loginStreak,
  };
}

export async function getUser(username: string): Promise<UserInternal | null> {
  if (isConfigured) {
    try {
      return await withRetry(async () => {
        const { data, error } = await adminDb
          .from('users')
          .select('*, clans:clan_id ( id, tag, name, emblem_icon_id, emblem_icon_color, emblem_bg_color )')
          .eq('username', username)
          .single();
        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }
        return mapSupabaseToUser(data);
      }, 'getUser');
    } catch (_) {
      return null;
    }
  }
  return users.get(username) ?? null;
}

export async function getUserById(id: string): Promise<UserInternal | null> {
  if (isConfigured) {
    try {
      return await withRetry(async () => {
        const { data, error } = await adminDb
          .from('users')
          .select('*, clans:clan_id ( id, tag, name, emblem_icon_id, emblem_icon_color, emblem_bg_color )')
          .eq('id', id)
          .single();
        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }
        return mapSupabaseToUser(data);
      }, 'getUserById');
    } catch (_) {
      return null;
    }
  }
  for (const u of users.values()) {
    if (u.id === id) return u;
  }
  return null;
}

export async function getUsersByIds(ids: string[]): Promise<UserInternal[]> {
  if (ids.length === 0) return [];
  if (isConfigured) {
    try {
      return await withRetry(async () => {
        const { data, error } = await adminDb
          .from('users')
          .select('*, clans:clan_id ( id, tag, name, emblem_icon_id, emblem_icon_color, emblem_bg_color )')
          .in('id', ids);
        if (error) throw error;
        return (data as any[])
          .map(mapSupabaseToUser)
          .filter((u: UserInternal | null): u is UserInternal => u !== null);
      }, 'getUsersByIds');
    } catch (_) {
      return [];
    }
  }
  return ids
    .map((id) => Array.from(users.values()).find((u) => u.id === id))
    .filter((u): u is UserInternal => !!u);
}

export async function getUserByGoogleId(googleId: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('users').select('*').eq('google_id', googleId).single();
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
    const { data, error } = await adminDb.from('users').select('*').eq('discord_id', discordId).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.discordId === discordId) return u;
  }
  return null;
}

export async function getUserByReferralCode(code: string): Promise<UserInternal | null> {
  if (!code) return null;
  if (isConfigured) {
    const { data, error } = await adminDb.from('users').select('*').eq('referral_code', code.toUpperCase()).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.referralCode?.toUpperCase() === code.toUpperCase()) return u;
  }
  return null;
}

export async function getUserByEmail(email: string): Promise<UserInternal | null> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('users').select('*').eq('email', email).single();
    if (error) return null;
    return mapSupabaseToUser(data);
  }
  for (const u of users.values()) {
    if (u.email === email) return u;
  }
  return null;
}

export async function saveUser(userData: UserInternal): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      const { error } = await adminDb.from('users').upsert(mapUserToSupabase(userData));
      if (error) throw error;
    }, 'saveUser');
  } else {
    users.set(userData.username, userData);
  }
}

export function makeNewUser(overrides: Partial<UserInternal> = {}): UserInternal {
  const id = overrides.id || randomUUID();
  const referralCode =
    overrides.referralCode ||
    Math.random().toString(36).substring(2, 10).toUpperCase();

  return {
    id,
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
      crisisWins: 0,
      crisisGames: 0,
      bettingWins: 0,
      bettingPoints: 0,
    },
    ownedCosmetics: [],
    cabinetPoints: 0,
    claimedRewards: [],
    earnedAchievements: [],
    pinnedAchievements: [],
    recentlyPlayedWith: [],
    isAdmin: false,
    isBanned: false,
    tokenVersion: 0,
    referralCode,
    referredBy: undefined,
    referralProcessed: false,
    lastLoginAt: undefined,
    loginStreak: 0,
    ...overrides,
  };
}

export async function createPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  if (isRedisConfigured && stateClient) {
    const ttlSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttlSeconds > 0) {
      await stateClient.setex(`resetToken:${token}`, ttlSeconds, userId);
      await stateClient.sadd(`userResetTokens:${userId}`, token);
      await stateClient.expire(`userResetTokens:${userId}`, ttlSeconds);
    }
  }

  if (isConfigured) {
    await adminDb.from('password_resets').insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    });
  } else if (!isRedisConfigured) {
    memoryResetTokens.set(token, { userId, expiresAt });
  }
}

export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  if (isRedisConfigured && stateClient) {
    const userId = await stateClient.get(`resetToken:${token}`);
    if (userId) {
      await stateClient.del(`resetToken:${token}`);
      await stateClient.srem(`userResetTokens:${userId}`, token);
      return userId;
    }
  }

  if (isConfigured) {
    const { data, error } = await adminDb
      .from('password_resets')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!error && data) {
      return data.user_id;
    }
  }

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
  if (isRedisConfigured && stateClient) {
    const tokens = await stateClient.smembers(`userResetTokens:${userId}`);
    if (tokens.length > 0) {
      await stateClient.del(...tokens.map((t) => `resetToken:${t}`));
    }
    await stateClient.del(`userResetTokens:${userId}`);
  }

  if (isConfigured) {
    await adminDb.from('password_resets').delete().eq('user_id', userId);
  }

  for (const [token, data] of memoryResetTokens.entries()) {
    if (data.userId === userId) memoryResetTokens.delete(token);
  }
}

type LeaderboardMode = 'Overall' | 'Ranked' | 'Casual' | 'Classic' | 'Crisis' | 'Betting';

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
            : mode === 'Crisis'
              ? 'stats->crisisWins'
              : mode === 'Betting'
                ? 'stats->bettingWins'
                : 'stats->wins';

    return await withRetry(async () => {
      const { data, error } = await adminDb
        .from('users')
        .select('*')
        .order(orderField as any, { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      if (error) throw error;
      return (data as any[])
        .map(mapSupabaseToUser)
        .filter((u: UserInternal | null): u is UserInternal => u !== null);
    }, 'getLeaderboard').catch(() => []);
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
  if (mode === 'Crisis')
    return allUsers
      .sort((a, b) => (b.stats.crisisWins ?? 0) - (a.stats.crisisWins ?? 0))
      .slice(safeOffset, safeOffset + safeLimit);
  if (mode === 'Betting')
    return allUsers
      .sort((a, b) => (b.stats.bettingWins ?? 0) - (a.stats.bettingWins ?? 0))
      .slice(safeOffset, safeOffset + safeLimit);
  return allUsers
    .sort((a, b) => (b.stats.wins ?? 0) - (a.stats.wins ?? 0))
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
  crisis: any[];
  betting: any[];
}> {
  const [overall, ranked, casual, classic, crisis, betting] = await Promise.all([
    getLeaderboard('Overall', limit, offset),
    getLeaderboard('Ranked', limit, offset),
    getLeaderboard('Casual', limit, offset),
    getLeaderboard('Classic', limit, offset),
    getLeaderboard('Crisis', limit, offset),
    getLeaderboard('Betting', limit, offset),
  ]);
  return { overall, ranked, casual, classic, crisis, betting };
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
    const { data, error } = await adminDb
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

  return results;
}

export async function processDailyLogin(user: UserInternal): Promise<{ bonusXp: number; bonusIp: number; streak: number } | null> {
  const now = new Date();
  const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;

  if (lastLogin) {
    const isSameDay =
      now.getFullYear() === lastLogin.getFullYear() &&
      now.getMonth() === lastLogin.getMonth() &&
      now.getDate() === lastLogin.getDate();

    if (isSameDay) return null;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      yesterday.getFullYear() === lastLogin.getFullYear() &&
      yesterday.getMonth() === lastLogin.getMonth() &&
      yesterday.getDate() === lastLogin.getDate();

    if (isYesterday) {
      user.loginStreak = (user.loginStreak || 0) + 1;
    } else {
      user.loginStreak = 1;
    }
  } else {
    user.loginStreak = 1;
  }

  user.lastLoginAt = now.toISOString();

  // Classic retention hook rewards
  const bonusXp = 50 + Math.min(user.loginStreak * 10, 250);
  const bonusIp = 25 + Math.min(user.loginStreak * 5, 125);

  user.stats.xp += bonusXp;
  user.stats.points += bonusIp;

  await saveUser(user);
  return { bonusXp, bonusIp, streak: user.loginStreak };
}

