import webpush from 'web-push';
import { env } from './env';
import { adminDb } from './db/core';
import { logger } from './logger';

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_EMAIL) {
  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  logger.info('[Push] VAPID details configured');
} else {
  logger.warn('[Push] VAPID details not set. Push notifications will be disabled.');
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: any;
}

export async function sendPushNotification(userId: string, payload: NotificationPayload) {
  if (!env.VAPID_PUBLIC_KEY) return;

  try {
    const { data: subscriptions, error } = await adminDb
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) return;

    const payloadString = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(sub.subscription, payloadString);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription has expired or is no longer valid, delete it
            await adminDb
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('subscription', sub.subscription);
            logger.info({ userId }, 'Deleted expired push subscription');
          } else {
            throw err;
          }
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error({ userId, failures }, 'Some push notifications failed to send');
    }
  } catch (err) {
    logger.error({ userId, err }, 'Error sending push notification');
  }
}
