import { supabase, isSupabaseConfigured } from '../../src/lib/supabase.ts';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../supabaseAdmin.ts';
import { logger } from '../logger.ts';

// Use regular client for most operations to respect RLS
export const db = supabase;
// Use admin client ONLY for privileged backend operations (bypasses RLS)
export const adminDb = isSupabaseAdminConfigured ? supabaseAdmin : supabase;
export const isConfigured = isSupabaseAdminConfigured || isSupabaseConfigured;

if (!isConfigured) {
  logger.fatal(
    'CRITICAL: SUPABASE_URL is not configured! A temporary in-memory Map is being used as a fallback for the database. ALL user accounts, progression, cosmetics, and match history WILL BE SILENTLY DISCARDED upon server restart or crash. Configure Supabase variables immediately in production.'
  );
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, name: string): Promise<T> {
  const delays = [500, 1000, 2000];
  let lastError: any;

  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Do not retry on "Not Found" errors from Supabase (PostgREST code PGRST116)
      if (err && (err.code === 'PGRST116' || err.status === 404)) {
        throw err;
      }

      if (attempt <= delays.length) {
        const delay = delays[attempt - 1];
        logger.warn(
          { 
            attempt, 
            nextDelay: delay, 
            function: name, 
            err: err instanceof Error ? err.message : String(err) 
          },
          `Supabase operation '${name}' failed. Retrying in ${delay}ms...`
        );
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  
  logger.error(
    { function: name, err: lastError instanceof Error ? lastError.message : String(lastError) },
    `Supabase operation '${name}' failed after ${delays.length + 1} attempts.`
  );
  throw lastError;
}
