import { describe, it, expect, vi, beforeEach } from 'vitest';

// Variables and functions used in vi.mock must be available during hoisting
const { viMockSupabase, viMockSupabaseAdmin } = vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-admin-key';

  const createMock = () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    limit: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
  });

  return {
    viMockSupabase: createMock(),
    viMockSupabaseAdmin: createMock(),
  };
});

// Mock dependencies
vi.mock('../../src/services/supabase', () => ({
  supabase: viMockSupabase as any,
  isSupabaseConfigured: true,
}));

vi.mock('../supabaseAdmin', () => ({
  supabaseAdmin: viMockSupabaseAdmin as any,
  isSupabaseAdminConfigured: true,
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

import * as service from '../supabaseService';
import { db } from '../supabaseService';

describe('supabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-verify that all return-this behaviors are set
    [viMockSupabase, viMockSupabaseAdmin].forEach((m: any) => {
      m.from.mockReturnThis();
      m.select.mockReturnThis();
      m.insert.mockReturnThis();
      m.update.mockReturnThis();
      m.upsert.mockReturnThis();
      m.delete.mockReturnThis();
      m.eq.mockReturnThis();
      m.neq.mockReturnThis();
      m.gt.mockReturnThis();
      m.or.mockReturnThis();
      m.in.mockReturnThis();
      m.order.mockReturnThis();
      m.range.mockReturnThis();
      m.limit.mockReturnThis();
      m.ilike.mockReturnThis();
    });
  });

  describe('Mapping Logic', () => {
    it('mapSupabaseToUser handles null input', () => {
      expect(service.mapSupabaseToUser(null)).toBeNull();
    });

    it('mapSupabaseToUser converts snake_case to camelCase properly', () => {
      const dbUser = {
        id: 'user-1',
        username: 'tester',
        avatar_url: 'http://avatar.com',
        stats: { elo: 1200 },
        owned_cosmetics: ['frame-1'],
        token_version: 5
      };
      const user = service.mapSupabaseToUser(dbUser);
      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-1');
      expect(user!.avatarUrl).toBe('http://avatar.com');
      expect(user!.stats.elo).toBe(1200);
      expect(user!.ownedCosmetics).toEqual(['frame-1']);
      expect(user!.tokenVersion).toBe(5);
    });
  });

  describe('Read Operations', () => {
    it('getUser fetches by username', async () => {
      const mockUser = { id: 'u1', username: 'tester' };
      (db.from('users').single as any).mockResolvedValue({ data: mockUser, error: null });

      const result = await service.getUser('tester');
      expect(db.from).toHaveBeenCalledWith('users');
      expect(db.from('users').select).toHaveBeenCalledWith('*');
      expect(db.from('users').eq).toHaveBeenCalledWith('username', 'tester');
      expect(result!.username).toBe('tester');
    });

    it('getUserById fetches by ID', async () => {
      const mockUser = { id: 'uuid-123', username: 'tester' };
      (db.from('users').single as any).mockResolvedValue({ data: mockUser, error: null });

      const result = await service.getUserById('uuid-123');
      expect(db.from('users').eq).toHaveBeenCalledWith('id', 'uuid-123');
      expect(result!.id).toBe('uuid-123');
    });
  });

  describe('Leaderboard', () => {
    it('getLeaderboard fetches ranked users sorted by ELO', async () => {
      (db.from('users').range as any).mockResolvedValue({ data: [], error: null });
      
      await service.getLeaderboard('Ranked', 10, 0);
      
      expect(db.from('users').order).toHaveBeenCalledWith('stats->elo', { ascending: false });
      expect(db.from('users').range).toHaveBeenCalledWith(0, 9);
    });

    it('getLeaderboard handles Casual mode (wins instead of ELO)', async () => {
      (db.from('users').range as any).mockResolvedValue({ data: [], error: null });
      
      await service.getLeaderboard('Casual', 20, 0);
      
      expect(db.from('users').order).toHaveBeenCalledWith('stats->casualWins', { ascending: false });
    });
  });

  describe('Friends', () => {
    it('getFriends fetches accepted relations and then user objects', async () => {
      // Mock friends table response
      (db.from('friends').eq as any).mockResolvedValue({ 
        data: [{ user_id_1: 'me', user_id_2: 'friend1' }], 
        error: null 
      });

      // Mock users table response for the resolved friend IDs
      (db.from('users').in as any).mockResolvedValue({
        data: [{ id: 'friend1', username: 'buddy' }],
        error: null
      });

      const friends = await service.getFriends('me');
      expect(friends).toHaveLength(1);
      expect(friends[0].username).toBe('buddy');
      expect(db.from('users').in).toHaveBeenCalledWith('id', ['friend1']);
    });

    it('isFriend returns true if relationship exists', async () => {
      (db.from('friends').single as any).mockResolvedValue({ data: { status: 'accepted' }, error: null });
      
      const result = await service.isFriend('u1', 'u2');
      expect(result).toBe(true);
    });
  });

  describe('Write Operations', () => {
    it('saveUser upserts the mapped user data', async () => {
      (db.from('users').upsert as any).mockResolvedValue({ error: null });
      
      const user = service.makeNewUser({ id: 'u1', username: 'newbie' });
      await service.saveUser(user);
      
      expect(db.from('users').upsert).toHaveBeenCalled();
      // Verify mapping: username should be same, id same
      const call = (db.from('users').upsert as any).mock.calls[0][0];
      expect(call.username).toBe('newbie');
      expect(call.id).toBe('u1');
    });

    it('incrementGlobalWin calls rpc', async () => {
      (db.rpc as any).mockResolvedValue({ error: null });
      
      await service.incrementGlobalWin('Civil');
      expect(db.rpc).toHaveBeenCalledWith('increment_global_win', { faction: 'Civil' });
    });
  });

  describe('Match History', () => {
    it('saveMatchResult inserts a new record', async () => {
      (db.from('match_history').insert as any).mockResolvedValue({ error: null });
      
      const match = {
        id: 'm1',
        userId: 'u1',
        playedAt: new Date().toISOString(),
        roomName: 'Lobby',
        mode: 'Ranked' as any,
        playerCount: 5,
        role: 'Civil' as any,
        won: true,
        winReason: 'Test',
        rounds: 10,
        civilDirectives: 5,
        stateDirectives: 2,
        agendaCompleted: true,
        xpEarned: 100,
        ipEarned: 50,
        cpEarned: 0
      };
      
      await service.saveMatchResult(match);
      expect(db.from('match_history').insert).toHaveBeenCalled();
      const call = (db.from('match_history').insert as any).mock.calls[0][0];
      expect(call.user_id).toBe('u1');
      expect(call.won).toBe(true);
    });
  });
});

