import { Request, Response } from 'express';
import { RouteContext } from './types.ts';
import { requireAdmin, sanitizeUser } from './shared.ts';
import { UserInternal } from '../../src/types.ts';
import { db, isConfigured, searchUsers, getSystemConfig } from '../supabaseService.ts';
import { logger } from '../logger.ts';

export function registerAdminRoutes({ app }: RouteContext): void {
  app.get('/api/admin/test', requireAdmin, async (req: Request, res: Response) => {
    const { data, error } = await db.from('users').select('id, username').limit(5);
    res.json({ data, error, isConfigured });
  });

  app.get('/api/admin/users/search', requireAdmin, async (req: Request, res: Response) => {
    const admin = (req as any).user;
    const query = req.query.q as string;
    logger.info({ adminId: admin.id, query }, 'Admin User Search Request');

    const users = await searchUsers(query, admin.id, 20);
    res.json(users.map((u) => sanitizeUser(u as UserInternal)));
  });

  app.get('/api/admin/config', requireAdmin, async (req: Request, res: Response) => {
    const config = await getSystemConfig();
    res.json(config);
  });
}
