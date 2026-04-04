/**
 * engine/utils.ts — Pure, stateless helpers shared across all engine modules.
 */

import { GameState, Policy } from '../../shared/types';
import { shuffle } from '../utils';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function pick<T>(arr: T[] | readonly T[]): T | undefined {
  return arr.length === 0 ? undefined : arr[Math.floor(Math.random() * arr.length)];
}

export function addLog(s: GameState, msg: string): void {
  s.log.push(msg);
  if (s.log.length > 50) s.log.shift();
}

export function ensureDeckHas(s: GameState, n: number): void {
  if (s.deck.length < n && s.discard.length > 0) {
    s.deck = shuffle([...s.deck, ...s.discard]);
    s.discard = [];
    addLog(s, 'Reshuffled discard pile into deck.');
  }
}

// ---------------------------------------------------------------------------
// ELO
// ---------------------------------------------------------------------------

/**
 * Standard ELO formula adapted for team games.
 * K=32 for players under 30 games (provisional), K=20 for established players.
 * opponentAvgElo is the average ELO of the opposing team.
 * Returns a signed integer delta (can be negative).
 */
export function computeEloChange(
  playerElo: number,
  opponentAvgElo: number,
  won: boolean,
  gamesPlayed: number
): number {
  const K = gamesPlayed < 30 ? 32 : 20;
  const expected = 1 / (1 + Math.pow(10, (opponentAvgElo - playerElo) / 400));
  return Math.round(K * ((won ? 1 : 0) - expected));
}

