/**
 * server/db/clans.ts
 *
 * All database operations for the Clans feature.
 * Follows the exact pattern of server/db/friends.ts — adminDb for reads,
 * withRetry for writes, in-memory fallback when Supabase is not configured.
 */

import { adminDb, isConfigured, withRetry } from './core';
import { logger } from '../logger';
import {
  Clan,
  ClanMember,
  ClanInvite,
  ClanRole,
  ClanSummary,
  ClanChallengeData,
} from '../../shared/types';

// ---------------------------------------------------------------------------
// In-memory fallback store (dev / unconfigured env)
// ---------------------------------------------------------------------------

const clanStore = new Map<string, Clan>();
const memberStore = new Map<string, ClanMember[]>(); // keyed by clanId
const inviteStore = new Map<string, ClanInvite[]>(); // keyed by inviteeId

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: any): Clan {
  return {
    id: row.id,
    tag: row.tag,
    name: row.name,
    description: row.description ?? '',
    ownerId: row.owner_id,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    emblem: {
      iconId: row.emblem_icon_id ?? 'Shield',
      iconColor: row.emblem_icon_color ?? '#FFFFFF',
      bgColor: row.emblem_bg_color ?? '#2A2A2A',
    },
    memberCount: row.member_count ?? 0,
    createdAt: row.created_at,
    challenges: row.challenges_data ? (row.challenges_data as ClanChallengeData) : undefined,
  };
}

function mapMemberRow(row: any): ClanMember {
  return {
    clanId: row.clan_id,
    userId: row.user_id,
    username: row.username ?? '',
    avatarUrl: row.avatar_url,
    activeFrame: row.active_frame,
    role: row.role as ClanRole,
    xpContributed: row.xp_contributed ?? 0,
    joinedAt: row.joined_at,
    isOnline: false,
  };
}

function mapInviteRow(row: any): ClanInvite {
  return {
    id: row.id,
    clanId: row.clan_id,
    clanName: row.clan_name ?? '',
    clanTag: row.clan_tag ?? '',
    inviterId: row.inviter_id,
    inviterName: row.inviter_name ?? '',
    inviteeId: row.invitee_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function computeClanLevel(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

// ---------------------------------------------------------------------------
// Clan CRUD
// ---------------------------------------------------------------------------

export async function createClan(
  ownerId: string,
  tag: string,
  name: string,
  description: string,
  emblem: { iconId: string; iconColor: string; bgColor: string }
): Promise<Clan | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (isConfigured) {
    return withRetry(async () => {
      const { data: clanData, error: clanErr } = await adminDb
        .from('clans')
        .insert({
          id,
          tag: tag.toUpperCase(),
          name,
          description,
          owner_id: ownerId,
          xp: 0,
          level: 1,
          emblem_icon_id: emblem.iconId,
          emblem_icon_color: emblem.iconColor,
          emblem_bg_color: emblem.bgColor,
          created_at: now,
        })
        .select()
        .single();
      if (clanErr) throw clanErr;

      const { error: memberErr } = await adminDb.from('clan_members').insert({
        clan_id: id,
        user_id: ownerId,
        role: 'owner',
        xp_contributed: 0,
        joined_at: now,
      });
      if (memberErr) throw memberErr;

      const { error: userErr } = await adminDb
        .from('users')
        .update({ clan_id: id })
        .eq('id', ownerId);
      if (userErr) throw userErr;

      return mapRow(clanData);
    }, 'createClan');
  }

  const clan: Clan = {
    id, tag: tag.toUpperCase(), name, description,
    ownerId, xp: 0, level: 1, emblem, memberCount: 1, createdAt: now,
  };
  clanStore.set(id, clan);
  memberStore.set(id, [{ clanId: id, userId: ownerId, username: '', role: 'owner', xpContributed: 0, joinedAt: now, isOnline: false }]);
  return clan;
}

export async function getClanById(clanId: string): Promise<Clan | null> {
  if (isConfigured) {
    const { data: countData } = await adminDb.from('clan_members').select('count', { count: 'exact', head: true }).eq('clan_id', clanId);
    const { data, error } = await adminDb.from('clans').select('*').eq('id', clanId).maybeSingle();
    if (error || !data) return null;
    const clan = mapRow(data);
    clan.memberCount = countData?.[0]?.count ?? 0;
    return clan;
  }
  return clanStore.get(clanId) ?? null;
}

export async function getClanByTag(tag: string): Promise<Clan | null> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clans').select('*').eq('tag', tag.toUpperCase()).maybeSingle();
    if (error || !data) return null;
    return getClanById(data.id);
  }
  return Array.from(clanStore.values()).find(c => c.tag === tag.toUpperCase()) ?? null;
}

export async function getClanByUserId(userId: string): Promise<Clan | null> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clan_members').select('clan_id').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return getClanById(data.clan_id);
  }
  for (const [clanId, members] of memberStore.entries()) {
    if (members.some(m => m.userId === userId)) return clanStore.get(clanId) ?? null;
  }
  return null;
}

export async function searchClans(query: string, limit = 20): Promise<ClanSummary[]> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clans').select('id, tag, name, description, xp, level, emblem_icon_id, emblem_icon_color, emblem_bg_color').or(`name.ilike.%${query}%,tag.ilike.%${query}%`).limit(limit);
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id, tag: r.tag, name: r.name, description: r.description ?? '',
      xp: r.xp ?? 0, level: r.level ?? 1,
      emblem: { iconId: r.emblem_icon_id, iconColor: r.emblem_icon_color, bgColor: r.emblem_bg_color },
      memberCount: 0,
    }));
  }
  return Array.from(clanStore.values()).filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.tag.toLowerCase().includes(query.toLowerCase())).map(c => ({ 
    id: c.id, tag: c.tag, name: c.name, description: c.description, xp: c.xp, level: c.level, emblem: c.emblem, memberCount: 0 
  }));
}

export async function updateClan(clanId: string, updates: any): Promise<void> {
  if (isConfigured) {
    const patch: any = {};
    if (updates.name) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.emblem) {
      if (updates.emblem.iconId) patch.emblem_icon_id = updates.emblem.iconId;
      if (updates.emblem.iconColor) patch.emblem_icon_color = updates.emblem.iconColor;
      if (updates.emblem.bgColor) patch.emblem_bg_color = updates.emblem.bgColor;
    }
    await withRetry(() => adminDb.from('clans').update(patch).eq('id', clanId), 'updateClan');
    return;
  }
  const clan = clanStore.get(clanId);
  if (clan) Object.assign(clan, updates);
}

export async function disbandClan(clanId: string): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      await adminDb.from('users').update({ clan_id: null }).eq('clan_id', clanId);
      await adminDb.from('clan_members').delete().eq('clan_id', clanId);
      await adminDb.from('clan_invites').delete().eq('clan_id', clanId);
      await adminDb.from('clans').delete().eq('id', clanId);
    }, 'disbandClan');
    return;
  }
  clanStore.delete(clanId);
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function getClanMembers(clanId: string): Promise<ClanMember[]> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clan_members').select('*, users!inner(username, avatar_url, active_frame)').eq('clan_id', clanId).order('xp_contributed', { ascending: false });
    if (error || !data) return [];
    return data.map((r: any) => ({
      clanId: r.clan_id, userId: r.user_id, username: r.users?.username ?? '', avatarUrl: r.users?.avatar_url, activeFrame: r.users?.active_frame,
      role: r.role, xpContributed: r.xp_contributed, joinedAt: r.joined_at, isOnline: false,
    }));
  }
  return memberStore.get(clanId) ?? [];
}

export async function addClanMember(clanId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  if (isConfigured) {
    await withRetry(async () => {
      await adminDb.from('clan_members').insert({ clan_id: clanId, user_id: userId, role: 'member', xp_contributed: 0, joined_at: now });
      await adminDb.from('users').update({ clan_id: clanId }).eq('id', userId);
    }, 'addClanMember');
    return;
  }
  const members = memberStore.get(clanId) ?? [];
  members.push({ clanId, userId, username: '', role: 'member', xpContributed: 0, joinedAt: now, isOnline: false });
  memberStore.set(clanId, members);
}

export async function removeClanMember(clanId: string, userId: string): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      await adminDb.from('clan_members').delete().eq('clan_id', clanId).eq('user_id', userId);
      await adminDb.from('users').update({ clan_id: null }).eq('id', userId);
    }, 'removeClanMember');
    return;
  }
  const members = (memberStore.get(clanId) ?? []).filter(m => m.userId !== userId);
  memberStore.set(clanId, members);
}

export async function updateMemberRole(clanId: string, userId: string, role: ClanRole): Promise<void> {
  if (isConfigured) {
    await withRetry(() => adminDb.from('clan_members').update({ role }).eq('clan_id', clanId).eq('user_id', userId), 'updateMemberRole');
    return;
  }
  const m = (memberStore.get(clanId) ?? []).find(m => m.userId === userId);
  if (m) m.role = role;
}

export async function transferClanOwnership(clanId: string, newOwnerId: string, oldOwnerId: string): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      await adminDb.from('clan_members').update({ role: 'officer' }).eq('clan_id', clanId).eq('user_id', oldOwnerId);
      await adminDb.from('clan_members').update({ role: 'owner' }).eq('clan_id', clanId).eq('user_id', newOwnerId);
      await adminDb.from('clans').update({ owner_id: newOwnerId }).eq('id', clanId);
    }, 'transferClanOwnership');
    return;
  }
  const clan = clanStore.get(clanId);
  if (clan) clan.ownerId = newOwnerId;
}

// ---------------------------------------------------------------------------
// XP & Challenges
// ---------------------------------------------------------------------------

export async function contributeClanXp(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  if (isConfigured) {
    try {
      await withRetry(() => adminDb.rpc('contribute_clan_xp', { p_user_id: userId, p_amount: amount }), 'contributeClanXp');
    } catch (err) {
      logger.warn({ err, userId, amount }, 'contributeClanXp failed');
    }
    return;
  }
  for (const [clanId, members] of memberStore.entries()) {
    const m = members.find(m => m.userId === userId);
    if (m) {
      m.xpContributed += amount;
      const clan = clanStore.get(clanId);
      if (clan) {
        clan.xp += amount;
        clan.level = computeClanLevel(clan.xp);
      }
      break;
    }
  }
}

export async function incrementClanXp(clanId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  if (isConfigured) {
    await adminDb.rpc('increment_clan_xp', { p_clan_id: clanId, p_amount: amount });
  } else {
    const clan = clanStore.get(clanId);
    if (clan) {
      clan.xp += amount;
      clan.level = computeClanLevel(clan.xp);
    }
  }
}

export async function saveClanChallenges(clanId: string, data: ClanChallengeData): Promise<void> {
  if (isConfigured) {
    await withRetry(() => adminDb.from('clans').update({ challenges_data: data }).eq('id', clanId), 'saveClanChallenges');
    return;
  }
  const clan = clanStore.get(clanId);
  if (clan) clan.challenges = data;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function createClanInvite(clanId: string, clanName: string, clanTag: string, inviterId: string, inviterName: string, inviteeId: string): Promise<ClanInvite | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (isConfigured) {
    const { data: existing } = await adminDb.from('clan_invites').select('id').eq('clan_id', clanId).eq('invitee_id', inviteeId).eq('status', 'pending').maybeSingle();
    if (existing) return null;
    const { data, error } = await adminDb.from('clan_invites').insert({ id, clan_id: clanId, clan_name: clanName, clan_tag: clanTag, inviter_id: inviterId, inviter_name: inviterName, invitee_id: inviteeId, status: 'pending', created_at: now }).select().single();
    if (error) return null;
    return mapInviteRow(data);
  }
  return { id, clanId, clanName, clanTag, inviterId, inviterName, inviteeId, status: 'pending', createdAt: now };
}

export async function getPendingInvitesForUser(userId: string): Promise<ClanInvite[]> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clan_invites').select('*').eq('invitee_id', userId).eq('status', 'pending');
    if (error || !data) return [];
    return data.map(mapInviteRow);
  }
  return [];
}

export async function respondToInvite(inviteId: string, inviteeId: string, accept: boolean): Promise<ClanInvite | null> {
  const status = accept ? 'accepted' : 'declined';
  if (isConfigured) {
    const { data, error } = await adminDb.from('clan_invites').update({ status }).eq('id', inviteId).eq('invitee_id', inviteeId).select().single();
    if (error || !data) return null;
    return mapInviteRow(data);
  }
  return null;
}

export async function getClanLeaderboard(limit = 50): Promise<ClanSummary[]> {
  if (isConfigured) {
    const { data, error } = await adminDb.from('clans').select('id, tag, name, description, xp, level, emblem_icon_id, emblem_icon_color, emblem_bg_color').order('xp', { ascending: false }).limit(limit);
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id, tag: r.tag, name: r.name, description: r.description ?? '', xp: r.xp, level: r.level, emblem: { iconId: r.emblem_icon_id, iconColor: r.emblem_icon_color, bgColor: r.emblem_bg_color }, memberCount: 0,
    }));
  }
  return Array.from(clanStore.values()).sort((a,b)=>b.xp-a.xp).slice(0,limit);
}
