import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleJoinRoom } from '../handlers/joinRoomHandler';
import { GameEngine } from '../gameEngine';
import { Server, Socket } from 'socket.io';
import * as supabase from '../supabaseService';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../supabaseService', () => ({
  getUserById: vi.fn(),
  getFriends: vi.fn().mockResolvedValue([]),
  isFriend: vi.fn().mockResolvedValue(false),
}));

describe('Reconnect Flow Integration', () => {
  let mockSocket: any;
  let mockIo: any;
  let engine: GameEngine;
  let userSockets: Map<string, string>;
  let currentConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSocket = {
      id: 'new-socket-id',
      join: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      data: { userId: 'user-123' },
    };

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      sockets: {
        adapter: {
          rooms: new Map(),
        },
      },
    };

    engine = new GameEngine({ io: mockIo as any, getConfig: () => ({}) as any });
    userSockets = new Map();
    currentConfig = { maintenanceMode: false };
    
    (supabase.getUserById as any).mockResolvedValue({
      id: 'user-123',
      username: 'Tester',
      avatarUrl: 'test.png',
      isBanned: false,
    });
  });

  describe('Lobby Reconnection', () => {
    it('re-associates a player in Lobby phase by userId', async () => {
      const roomId = 'test-room';
      // Setup: Room exists with a player who has an old socket ID
      const initialPlayer = {
        id: 'p1',
        userId: 'user-123',
        socketId: 'old-socket-id',
        name: 'Tester',
        isDisconnected: true, // Not strictly required by lobby logic but good for realism
      };
      
      engine.rooms.set(roomId, {
        roomId,
        phase: 'Lobby',
        players: [initialPlayer as any],
        spectators: [],
        maxPlayers: 10,
        log: [],
      } as any);

      await handleJoinRoom(
        mockSocket as any,
        mockIo as any,
        engine,
        userSockets,
        currentConfig,
        { roomId, name: 'Tester', userId: 'user-123' }
      );

      const state = engine.rooms.get(roomId);
      expect(state?.players).toHaveLength(1);
      expect(state?.players[0].socketId).toBe('new-socket-id');
      expect(state?.log).toContain('Tester rejoined the lobby.');
      expect(mockSocket.join).toHaveBeenCalledWith(roomId);
    });
  });

  describe('In-Game Reconnection', () => {
    it('re-associates a player in Nominating phase and clears pause state', async () => {
      const roomId = 'active-room';
      const initialPlayer = {
        id: 'p1',
        userId: 'user-123',
        socketId: 'old-socket-id',
        name: 'Tester',
        isDisconnected: true,
      };

      engine.rooms.set(roomId, {
        roomId,
        phase: 'Nominate_Chancellor',
        players: [initialPlayer as any],
        spectators: [],
        maxPlayers: 10,
        isPaused: true,
        pauseReason: 'Player Disconnected',
        log: ['Player disconnected.'],
      } as any);

      await handleJoinRoom(
        mockSocket as any,
        mockIo as any,
        engine,
        userSockets,
        currentConfig,
        { roomId, name: 'Tester', userId: 'user-123' }
      );

      const state = engine.rooms.get(roomId);
      expect(state?.players[0].socketId).toBe('new-socket-id');
      expect(state?.players[0].isDisconnected).toBe(false);
      expect(state?.isPaused).toBe(false);
      expect(state?.log).toContain('Tester reconnected.');
      expect(mockSocket.join).toHaveBeenCalledWith(roomId);
    });

    it('denies reconnection if userId mismatch', async () => {
       const roomId = 'active-room';
       engine.rooms.set(roomId, {
         roomId,
         phase: 'Nominate_Chancellor',
         players: [{ userId: 'other-user', name: 'Other' }],
       } as any);

       mockSocket.data.userId = 'user-123'; // My authorized ID

       await handleJoinRoom(
         mockSocket as any,
         mockIo as any,
         engine,
         userSockets,
         currentConfig,
         { roomId, name: 'Tester', userId: 'bad-id' } // I try to claim another ID
       );

       expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.stringContaining('Unauthorized'));
    });
  });
});
