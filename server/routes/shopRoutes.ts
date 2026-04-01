import { Request, Response } from 'express';
import { RouteContext } from './types';
import { DEFAULT_ITEMS, CP_PACKAGES } from '../../src/sharedConstants';
import { saveUser } from '../supabaseService';
import { requireAuth, sanitizeUser } from './shared';
import { logger } from '../logger';
import rateLimit from 'express-rate-limit';

export function registerShopRoutes({ app, stripe }: RouteContext): void {
  const costLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  app.post('/api/shop/buy', costLimiter, requireAuth, async (req: Request, res: Response) => {
    const { itemId } = req.body;
    const user = req.user!;

    const item = DEFAULT_ITEMS.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (user.stats.points < item.price) return res.status(400).json({ error: 'Not enough points' });
    if (user.ownedCosmetics.includes(itemId)) return res.status(400).json({ error: 'Already owned' });

    user.stats.points -= item.price;
    user.ownedCosmetics.push(itemId);
    await saveUser(user);
    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword });
  });

  app.post('/api/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
    if (!process.env.STRIPE_SECRET_KEY)
      return res.status(503).json({ error: 'Payment service not configured.' });

    const { packageId } = req.body;
    const user = req.user!;

    try {
      const pkg = CP_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) return res.status(400).json({ error: 'Invalid package' });

      const origin = process.env.APP_URL || 'https://theassembly.web.app';

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pkg.name,
                description: `Purchase ${pkg.cp} Cabinet Points`,
              },
              unit_amount: pkg.price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/?purchase=success`,
        cancel_url: `${origin}/?purchase=cancel`,
        metadata: {
          userId: user.id,
          cpAmount: pkg.cp.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Stripe Create Session Error');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });
}

