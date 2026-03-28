import { Policy } from '../src/types.ts';
import { Request } from 'express';

export const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2,4}\.a\.run\.app$/;

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
  const origin = (req?.query?.origin as string) || (req?.body?.origin as string);
  if (origin && isAllowedOrigin(origin)) return origin;

  if (req?.query?.state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(req.query.state as string));
      if (stateData.origin && isAllowedOrigin(stateData.origin)) {
        return stateData.origin;
      }
    } catch (_) {}
  }

  return process.env.APP_URL || 'https://theassembly.web.app';
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
