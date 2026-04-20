import { Policy } from '../shared/types';
import { Request } from 'express';

export const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = [
    process.env.APP_URL,
    'https://theassembly.web.app',
    'http://localhost:3000',
    'http://localhost',
    'capacitor://localhost',
  ].filter(Boolean);
  return explicit.includes(origin) || CLOUD_RUN_PATTERN.test(origin);
}

export function getAppUrl(req?: Request): string {
  // 1. Check if the client explicitly sent their origin (common in our API calls)
  const origin = (req?.query?.origin as string) || (req?.body?.origin as string);
  if (origin && isAllowedOrigin(origin)) return origin.replace(/\/$/, '');

  // 2. Check for Proxy headers (Cloud Run sends x-forwarded-host)
  if (req) {
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
    if (forwardedHost && isAllowedOrigin(`${forwardedProto}://${forwardedHost}`)) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  // 3. Check the internal state parameter (used in OAuth redirects)
  if (req?.query?.state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(req.query.state as string));
      if (stateData.origin && isAllowedOrigin(stateData.origin)) {
        return stateData.origin.replace(/\/$/, '');
      }
    } catch (_) {}
  }

  // 4. Default to APP_URL or the primary custom domain
  return (process.env.APP_URL || 'https://theassembly.web.app').replace(/\/$/, '');
}

export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function createDeck(): Policy[] {
  const deck: Policy[] = [];
  for (let i = 0; i < 6; i++) deck.push('Civil');
  for (let i = 0; i < 11; i++) deck.push('State');
  return shuffle(deck);
}

