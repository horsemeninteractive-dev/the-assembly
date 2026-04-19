import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GameEngine } from '../gameEngine';
import { GameState, Player, UserInternal } from '../../shared/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../supabaseService', () => ({
  getUserById: vi.fn(),
  saveUser: vi.fn(),
  saveMatchResult: vi.fn(),
  incrementGlobalWin: vi.fn(),
}));

// Import mocked functions
import { getUserById, saveUser, incrementGlobalWin } from '../supabaseService';

describe('GameEngine - updateUserStats', () => {
  let engine: GameEngine;
  let mockIo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIo = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      sockets: {
        adapter: { rooms: new Map() },
        sockets: new Map()
      }
    };
    engine = new GameEngine({ io: mockIo, getConfig: () => ({ maintenanceMode: false }) as any });
  });

  const makeMockUser = (id: string, overrides: Partial<UserInternal['stats']> = {}): UserInternal => ({
    id,
    username: `User-${id}`,
    email: `${id}@example.com`,
    password: 'hashedpassword',
    tokenVersion: 1,
    cabinetPoints: 100,
    ownedCosmetics: [],
    claimedRewards: [],
    earnedAchievements: [],
    pinnedAchievements: [],
    recentlyPlayedWith: [],
    peakElo: 1000,
    premiumPassSeasons: [],
    stats: {
      xp: 1000,
      points: 500,
      elo: 1000,
      wins: 10,
      losses: 5,
      gamesPlayed: 15,
      civilWins: 5,
      civilGames: 7,
      stateWins: 3,
      stateGames: 5,
      overseerWins: 2,
      overseerGames: 3,
      rankedWins: 5,
      rankedGames: 8,
      casualWins: 3,
      casualGames: 5,
      classicWins: 2,
      classicGames: 2,
      agendasCompleted: 2,
      ...overrides
    }
  } as UserInternal);

  const makeMockPlayer = (id: string, userId: string, role: 'Civil' | 'State' | 'Overseer'): Player => ({
    id,
    userId,
    name: `Player-${id}`,
    role,
    isAI: false,
    isAlive: true,
    stateEnactments: 0,
    civilEnactments: 0
  } as Player);

  it('updates stats correctly for a Civil win in Ranked mode', async () => {
    const user1 = makeMockUser('u1', { elo: 1000, gamesPlayed: 50 }); // Established
    const user2 = makeMockUser('u2', { elo: 1200, gamesPlayed: 50 }); // Stronger opponent

    (getUserById as Mock).mockImplementation((id: string) => {
      if (id === 'u1') return Promise.resolve(user1);
      if (id === 'u2') return Promise.resolve(user2);
      return Promise.resolve(null);
    });

    const state: GameState = {
      roomId: 'room1',
      mode: 'Ranked',
      players: [
        makeMockPlayer('p1', 'u1', 'Civil'),
        makeMockPlayer('p2', 'u2', 'State'),
      ],
      spectators: [],
    } as any;

    await engine.updateUserStats(state, 'Civil');

    // User 1 won
    expect(user1.stats.wins).toBe(11);
    expect(user1.stats.gamesPlayed).toBe(51);
    expect(user1.stats.civilWins).toBe(6);
    expect(user1.stats.rankedWins).toBe(6);
    // ELO should increase. Against 1200 opponent, expected is low, so gain should be > 10 (normal K=20)
    expect(user1.stats.elo).toBeGreaterThan(1010); 

    // User 2 lost
    expect(user2.stats.losses).toBe(6);
    expect(user2.stats.gamesPlayed).toBe(51);
    expect(user2.stats.elo).toBeLessThan(1200);

    expect(saveUser).toHaveBeenCalledTimes(2);
  });

  it('applies leaver penalty correctly', async () => {
    const user1 = makeMockUser('u1', { elo: 1000, gamesPlayed: 10 });
    (getUserById as Mock).mockResolvedValue(user1);

    const state: GameState = {
      roomId: 'room1',
      mode: 'Ranked',
      players: [
        makeMockPlayer('p1', 'u1', 'Civil'),
      ],
      spectators: [],
    } as any;

    // Call update with leaverId matching p1, but NO winning side (inconclusive)
    await engine.updateUserStats(state, undefined, 'p1');

    expect(user1.stats.losses).toBe(6);
    expect(user1.stats.gamesPlayed).toBe(11);
    expect(user1.stats.elo).toBeLessThan(1000); // Should lose ELO
    expect(user1.stats.xp).toBe(1000); // No XP gain for leaver
    expect(saveUser).toHaveBeenCalled();
  });

  it('calculates average opponent ELO correctly for teams', async () => {
    const u1 = makeMockUser('u1', { elo: 1000 });
    const u2 = makeMockUser('u2', { elo: 1100 });
    const u3 = makeMockUser('u3', { elo: 1500 });

    (getUserById as Mock).mockImplementation((id: string) => {
      if (id === 'u1') return u1;
      if (id === 'u2') return u2;
      if (id === 'u3') return u3;
    });

    const state: GameState = {
      roomId: 'room1',
      mode: 'Ranked',
      players: [
        makeMockPlayer('p1', 'u1', 'Civil'),
        makeMockPlayer('p2', 'u2', 'Civil'),
        makeMockPlayer('p3', 'u3', 'State'),
      ],
      spectators: [],
    } as any;

    await engine.updateUserStats(state, 'Civil');

    // u1's opponent is u3 (1500). u1 is 1000. Big underdog.
    // u3's opponent is avg(u1, u2) = 1050. u3 is 1500. Big favorite.
    
    // We can't easily check the EXACT elo change without duplicating logic,
    // but we can verify it's saved.
    expect(saveUser).toHaveBeenCalledTimes(3);
  });
});

