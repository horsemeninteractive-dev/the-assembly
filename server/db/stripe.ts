import { adminDb, isConfigured, withRetry } from './core.ts';

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  if (!isConfigured) return false;
  return await withRetry(async () => {
    const { data, error } = await adminDb
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }, 'isStripeEventProcessed');
}

export async function recordStripeEvent(eventId: string, userId?: string): Promise<void> {
  if (!isConfigured) return;
  await withRetry(async () => {
    const { error } = await adminDb.from('stripe_events').insert({ event_id: eventId, user_id: userId });
    if (error) throw error;
  }, 'recordStripeEvent');
}
