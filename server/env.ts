import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from './logger';

/**
 * server/env.ts
 *
 * Centralized environment variable validation using Zod.
 * Ensures the server stops immediately if critical variables are missing or misconfigured,
 * providing a single clear failure report in the logs.
 */

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),
  
  // Security & Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for security compliance'),
  
  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required for client fallbacks'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for administrative database access (bypass RLS)'),
  
  // Persistence
  REDIS_URL: z.string().url().optional(),

  // Payments (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Email (Nodemailer / Resend)
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // External Services
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  
  // OAuth (Google)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // OAuth (Discord)
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // App URLs
  APP_URL: z.string().url().optional().default('https://theassembly.web.app'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const { fieldErrors } = parseResult.error.flatten();
  const errorMsg = Object.entries(fieldErrors)
    .map(([field, errors]) => `  - ${field}: ${errors?.join(', ')}`)
    .join('\n');

  logger.fatal(`CRITICAL: Environment variable validation failed!\n${errorMsg}`);
  process.exit(1);
}

export const env = parseResult.data;

// ---------------------------------------------------------------------------
// Contextual Validation (Production Guardrails)
// ---------------------------------------------------------------------------

if (env.NODE_ENV === 'production') {
  if (!env.REDIS_URL) {
    logger.fatal('CRITICAL: REDIS_URL is required in production for High Availability, session persistence, and multi-instance orchestration.');
    process.exit(1);
  }
  
  if (!env.APP_URL || env.APP_URL.includes('localhost')) {
    logger.warn('WARNING: APP_URL is not set or points to localhost in production. This may break OAuth redirects and deep-linking.');
  }
}

// ---------------------------------------------------------------------------
// Optional Service Warnings
// ---------------------------------------------------------------------------

if (!env.STRIPE_SECRET_KEY) {
  logger.warn('[Config] STRIPE_SECRET_KEY not set — payment/shop endpoints will return 503.');
}
if (!env.STRIPE_WEBHOOK_SECRET) {
  logger.info('[Config] STRIPE_WEBHOOK_SECRET not set — Stripe webhook signature verification will fail.');
}
if (!env.EMAIL_USER) {
  logger.info('[Config] EMAIL_USER not set — password recovery emails via Nodemailer are disabled.');
}
if (!env.RESEND_API_KEY) {
  logger.info('[Config] RESEND_API_KEY not set — backup email functionality via Resend is disabled.');
}

