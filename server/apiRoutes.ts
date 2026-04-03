import { Express } from 'express';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { GameEngine } from './gameEngine';

import { RouteContext } from './routes/types';
import { registerAuthRoutes } from './routes/authRoutes';
import { registerOAuthRoutes } from './routes/oauthRoutes';
import { registerUserRoutes } from './routes/userRoutes';
import { registerFriendRoutes } from './routes/friendRoutes';
import { registerRoomRoutes } from './routes/roomRoutes';
import { registerShopRoutes } from './routes/shopRoutes';
import { registerAdminRoutes } from './routes/adminRoutes';
import { registerSystemRoutes } from './routes/systemRoutes';
import { registerPublicRoutes } from './routes/publicRoutes';
import { registerClanRoutes } from './routes/clanRoutes';

// Re-export common utilities so other files do not break.
export { sanitizeUser, validateToken, requireAuth } from './routes/shared';

export function registerRoutes(
  app: Express,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>,
  stripe: any
): void {
  const context: RouteContext = {
    app,
    io,
    engine,
    userSockets,
    stripe,
  };

  // High-frequency: blanket cap on all API routes.
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  app.use('/api', generalLimiter);

  // Register domain-specific route controllers
  registerAuthRoutes(context);
  registerOAuthRoutes(context);
  registerUserRoutes(context);
  registerFriendRoutes(context);
  registerRoomRoutes(context);
  registerShopRoutes(context);
  registerAdminRoutes(context);
  registerSystemRoutes(context);
  registerPublicRoutes(context);
  registerClanRoutes(context);
}

