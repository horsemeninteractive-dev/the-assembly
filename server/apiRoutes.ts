import { Express } from 'express';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { GameEngine } from './gameEngine.ts';

import { RouteContext } from './routes/types.ts';
import { registerAuthRoutes } from './routes/authRoutes.ts';
import { registerOAuthRoutes } from './routes/oauthRoutes.ts';
import { registerUserRoutes } from './routes/userRoutes.ts';
import { registerFriendRoutes } from './routes/friendRoutes.ts';
import { registerRoomRoutes } from './routes/roomRoutes.ts';
import { registerShopRoutes } from './routes/shopRoutes.ts';
import { registerAdminRoutes } from './routes/adminRoutes.ts';
import { registerSystemRoutes } from './routes/systemRoutes.ts';

// Re-export common utilities so other files do not break.
export { sanitizeUser, validateToken, requireAuth } from './routes/shared.ts';

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
  registerUserRoutes(context);
  registerFriendRoutes(context);
  registerRoomRoutes(context);
  registerShopRoutes(context);
  registerAdminRoutes(context);
  registerSystemRoutes(context);
}
