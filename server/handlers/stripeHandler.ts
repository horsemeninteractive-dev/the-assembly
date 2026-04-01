import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { Server } from 'socket.io';
import {
  isStripeEventProcessed,
  recordStripeEvent,
  getUserById,
  saveUser,
} from '../supabaseService.ts';
import { getSocketId } from '../redis.ts';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || '');

export function registerStripeWebhook(app: express.Application, getIo: () => Server, getUserSockets: () => Map<string, string>) {
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured.' });
    }
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      logger.error('Missing Stripe signature or webhook secret');
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Stripe Webhook Error');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const cpAmount = parseInt(session.metadata?.cpAmount || '0', 10);

      const alreadyProcessed = await isStripeEventProcessed(event.id);
      if (alreadyProcessed) {
        logger.info({ eventId: event.id }, 'Stripe event already processed, skipping');
        return res.json({ received: true });
      }

      if (userId && cpAmount > 0) {
        logger.info({ userId, cpAmount, eventId: event.id }, 'Crediting CP to user via Stripe');
        const user = await getUserById(userId);
        if (user) {
          user.cabinetPoints = (user.cabinetPoints ?? 0) + cpAmount;
          await saveUser(user);
          await recordStripeEvent(event.id, userId);

          // Notify the user via socket if they are online
          const io = getIo();
          const userSockets = getUserSockets();
          const socketId = await getSocketId(userId, userSockets);
          if (socketId && io) {
            io.to(socketId).emit('userUpdate', user);
          }
        }
      } else {
        // Record as processed even if no user/CP was credited to prevent reuse
        await recordStripeEvent(event.id, userId);
      }
    }

    res.json({ received: true });
  });
}
