import { adminDb, isConfigured, withRetry } from './core.ts';
import { UserInternal, MatchSummary } from '../../src/types.ts';
import { mapUserToSupabase, saveUser } from './users.ts';
import { logger } from '../logger.ts';

const matchHistoryStore: Map<string, MatchSummary[]> = new Map();

export async function saveMatchResult(
  match: Omit<MatchSummary, 'id'> & { id: string }
): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      const { error } = await adminDb.from('match_history').insert({
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
      if (error) throw error;
    }, 'saveMatchResult');
  } else {
    const existing = matchHistoryStore.get(match.userId) ?? [];
    existing.unshift(match as any);
    matchHistoryStore.set(match.userId, existing.slice(0, 50));
  }
}

export async function saveMatchAndUserAtomic(
  userData: UserInternal,
  match: Omit<MatchSummary, 'id'> & { id: string }
): Promise<void> {
  if (isConfigured) {
    await withRetry(async () => {
      const { error } = await adminDb.rpc('handle_match_end_per_player', {
        p_user_id: userData.id,
        p_user_data: mapUserToSupabase(userData),
        p_match_data: match,
      });
      if (error) {
        logger.warn({ err: error }, 'RPC handle_match_end_per_player failed, falling back to sequential save');
        const { error: matchErr } = await adminDb.from('match_history').insert({
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
          agenda_id: match.agendaId,
          agenda_name: match.agendaName,
          agenda_completed: match.agendaCompleted,
          xp_earned: match.xpEarned,
          ip_earned: match.ipEarned,
          cp_earned: match.cpEarned,
        });
        if (matchErr) throw matchErr;
        
        const { error: userErr } = await adminDb.from('users').update(mapUserToSupabase(userData)).eq('id', userData.id);
        if (userErr) throw userErr;
      }
    }, 'saveMatchAndUserAtomic');
  } else {
    // Fallback for non-configured env: just do sequentially
    await saveUser(userData);
    await saveMatchResult(match);
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
    const { data, error } = await adminDb
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

export async function getGlobalStats(): Promise<{ civilWins: number; stateWins: number }> {
  if (isConfigured) {
    try {
      return await withRetry(async () => {
        const { data, error } = await adminDb
          .from('global_stats')
          .select('civil_wins, state_wins')
          .eq('id', 1)
          .single();
        if (error || !data) throw error || new Error('Global stats not found');
        return { civilWins: data.civil_wins, stateWins: data.state_wins };
      }, 'getGlobalStats');
    } catch (_) {
      return { civilWins: 0, stateWins: 0 };
    }
  }
  return { civilWins: 0, stateWins: 0 };
}

export async function incrementGlobalWin(faction: 'Civil' | 'State'): Promise<void> {
  if (isConfigured) {
    await adminDb.rpc('increment_global_win', { faction });
  }
}
