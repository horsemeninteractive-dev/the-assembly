import { adminDb, db, isConfigured, withRetry } from './core.ts';
import { UserInternal } from '../../src/types.ts';
import { mapSupabaseToUser } from './users.ts';

export async function getFriends(userId: string): Promise<UserInternal[]> {
  if (isConfigured) {
    try {
      return await withRetry(async () => {
        const { data, error } = await adminDb
          .from('friends')
          .select('*, user_id_1, user_id_2')
          .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
          .eq('status', 'accepted');
        if (error) throw error;

        const friendIds = (data as any[]).map((f: any) =>
          f.user_id_1 === userId ? f.user_id_2 : f.user_id_1
        );
        const { data: friendsData, error: friendsError } = await adminDb
          .from('users')
          .select('*')
          .in('id', friendIds);
        if (friendsError) throw friendsError;
        return (friendsData as any[])
          .map(mapSupabaseToUser)
          .filter((u: UserInternal | null): u is UserInternal => u !== null);
      }, 'getFriends');
    } catch (_) {
      return [];
    }
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
    const { data, error } = await adminDb
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
        `and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_2.eq.${userId1})`
      );
  }
}

export async function getPendingFriendRequests(userId: string): Promise<UserInternal[]> {
  if (isConfigured) {
    const { data, error } = await adminDb
      .from('friends')
      .select('user_id_1')
      .eq('user_id_2', userId)
      .eq('status', 'pending');
    if (error || !data || data.length === 0) return [];
    const senderIds = (data as Array<{ user_id_1: string }>).map((r) => r.user_id_1);
    const { data: senders, error: sendersError } = await adminDb
      .from('users')
      .select('*')
      .in('id', senderIds);
    return senders
      .map(mapSupabaseToUser)
      .filter((u: UserInternal | null): u is UserInternal => u !== null);
  }
  return [];
}
