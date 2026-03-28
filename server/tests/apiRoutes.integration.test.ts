import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long-123456';
});

import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../apiRoutes';
import { GameEngine } from '../gameEngine';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../supabaseService', () => ({
  getUser: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  saveUser: vi.fn(),
  makeNewUser: (data: any) => ({ ...data, stats: { points: 0 }, ownedCosmetics: [], claimedRewards: [], earnedAchievements: [], recentlyPlayedWith: [], tokenVersion: 1 }),
  getLeaderboard: vi.fn(),
  getSystemConfig: vi.fn().mockResolvedValue({ maintenanceMode: false }),
  getAllLeaderboards: vi.fn().mockResolvedValue({ overall: [], ranked: [], casual: [], classic: [] }),
  isConfigured: true,
}));

// Supabase service imports must follow the mock
import { getUser, getUserById, getUserByEmail, saveUser, getAllLeaderboards } from '../supabaseService';

describe('API Routes Integration Tests', () => {
  let app: express.Express;
  let engine: GameEngine;
  const JWT_SECRET = process.env.JWT_SECRET!;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Mock dependencies for registerRoutes
    const io = { 
      sockets: { 
        adapter: { rooms: new Map() },
        get: vi.fn()
      },
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() })
    } as any;
    
    engine = new GameEngine({ io, getConfig: () => ({}) as any });
    const userSockets = new Map<string, string>();
    const stripe = {};
    
    registerRoutes(app, io, engine, userSockets, stripe);
  });

  describe('GET /version', () => {
    it('returns the current version', async () => {
      const response = await request(app).get('/version');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('POST /api/register', () => {
    it('successfully registers a new user', async () => {
      (getUser as Mock).mockResolvedValue(null);
      (getUserByEmail as Mock).mockResolvedValue(null);
      (saveUser as Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('testuser');
      expect(saveUser).toHaveBeenCalled();
    });

    it('fails when username already exists', async () => {
      (getUser as Mock).mockResolvedValue({ id: 'existing' });
      
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username already exists');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns success even if user not found (to prevent enumeration)', async () => {
      (getUserByEmail as Mock).mockResolvedValue(null);
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If an account exists');
    });

    it('requires valid email in payload', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Authenticated Routes', () => {
    const mockUser = { id: 'user-123', username: 'testuser', tokenVersion: 1, stats: { points: 100 }, ownedCosmetics: [], claimedRewards: [] };
    const validToken = jwt.sign({ userId: 'user-123', tokenVersion: 1 }, JWT_SECRET);

    beforeEach(() => {
      (getUserById as Mock).mockResolvedValue(mockUser);
    });

    describe('GET /api/me', () => {
      it('returns user profile for valid token', async () => {
        const response = await request(app)
          .get('/api/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe('user-123');
      });
    });

    describe('POST /api/user/update-username', () => {
      it('updates username successfully', async () => {
        (getUser as Mock).mockResolvedValue(null); // new name available
        (saveUser as Mock).mockResolvedValue(true);

        const response = await request(app)
          .post('/api/user/update-username')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ newUsername: 'newname' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.username).toBe('newname');
      });

      it('rejects duplicate username', async () => {
        (getUser as Mock).mockResolvedValue({ id: 'someone-else' });

        const response = await request(app)
          .post('/api/user/update-username')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ newUsername: 'exists' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Username already taken');
      });
    });

    describe('GET /api/leaderboard', () => {
      it('returns leaderboard data', async () => {
        (getAllLeaderboards as Mock).mockResolvedValue({
          overall: [mockUser],
          ranked: [],
          casual: [],
          classic: []
        });
        
        const response = await request(app)
          .get('/api/leaderboard?limit=10')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('overall');
        expect(Array.isArray(response.body.overall)).toBe(true);
      });
    });
  });
});
