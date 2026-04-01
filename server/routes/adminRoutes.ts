import { Request, Response } from 'express';
import { RouteContext } from './types';
import { requireAdmin, sanitizeUser } from './shared';
import { UserInternal } from '../../shared/types';
import { getRedisStatus } from '../redis';
import { db, isConfigured, searchUsers, getSystemConfig } from '../supabaseService';
import { logger } from '../logger';

export function registerAdminRoutes({ app, engine }: RouteContext): void {
  app.get('/api/admin/test', requireAdmin, async (req: Request, res: Response) => {
    const { data, error } = await db.from('users').select('id, username').limit(5);
    res.json({ data, error, isConfigured });
  });

  app.get('/api/admin/users/search', requireAdmin, async (req: Request, res: Response) => {
    const admin = req.user;
    if (!admin) return res.status(401).json({ error: 'Auth missing' });
    const query = (req.query.q as string) || '';
    const users: UserInternal[] = await searchUsers(query, admin.id, 20);
    res.json(users.map(sanitizeUser));
  });

  app.get('/api/admin/config', requireAdmin, async (req: Request, res: Response) => {
    const config = await getSystemConfig();
    res.json(config);
  });

  app.get('/api/admin/health', requireAdmin, (req: Request, res: Response) => {
    const memory = process.memoryUsage();
    res.json({
      status: 'healthy',
      rooms: engine.rooms.size,
      redis: getRedisStatus(),
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      },
    });
  });
}

