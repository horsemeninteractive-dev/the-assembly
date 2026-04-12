import { RouteContext } from './types';
import { requireAuth } from './shared';
import { adminDb } from '../db/core';
import { z } from 'zod';
import { logger } from '../logger';

const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  deviceType: z.enum(['web', 'mobile']),
});

export function registerPushRoutes({ app }: RouteContext) {
  app.get('/api/push/config', (req, res) => {
    res.json({
      publicKey: env.VAPID_PUBLIC_KEY,
    });
  });

  app.post('/api/push/register', requireAuth, async (req: any, res) => {
    try {
      const result = pushSubscriptionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid subscription data' });
      }

      const { subscription, deviceType } = result.data;
      const userId = req.user.id;

      const { error } = await adminDb
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            subscription,
            device_type: deviceType,
          },
          { onConflict: 'user_id, subscription' }
        );

      if (error) throw error;

      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to register push subscription');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/push/unregister', requireAuth, async (req: any, res) => {
    try {
      const { subscription } = req.body;
      const userId = req.user.id;

      const { error } = await adminDb
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('subscription', subscription);

      if (error) throw error;

      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to unregister push subscription');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
