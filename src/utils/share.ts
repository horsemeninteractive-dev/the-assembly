
import { GameState, PostMatchResult } from '../../shared/types';
import { extractBigPlays, getFactionCounts } from './game';

export interface ShareState {
  w: 'C' | 'S'; // winner
  r: string;    // reason
  m: string;    // mode
  rd: number;   // rounds
  f: { C: number; S: number; O: number }; // factions
  k: string[];  // key moments
}

/**
 * Generates a shareable URL containing the match summary encoded in the fragment or path.
 * We use a base64-encoded JSON blob.
 */
export function generateShareUrl(gameState: GameState, t: any = (k: string) => k): string {
  const factions = getFactionCounts(gameState);
  const moments = extractBigPlays(gameState, t).map((m) => m.text);

  const state: ShareState = {
    w: gameState.winner === 'Civil' ? 'C' : 'S',
    r: gameState.winReason || (gameState.winner === 'Civil' ? 'Charter Restored' : 'State Supremacy'),
    m: gameState.mode,
    rd: gameState.round,
    f: { C: factions.Civil, S: factions.State, O: factions.Overseer },
    k: moments,
  };

  try {
    const json = JSON.stringify(state);
    // Use btoa for basic encoding; encoded data is ASCII-safe for URLs.
    // For broader support with special characters, we'd use TextEncoder or similar.
    const encoded = btoa(json)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/m/${encoded}`;
  } catch (err) {
    console.error('Failed to generate share URL', err);
    return window.location.origin;
  }
}

export function getTwitterShareUrl(shareUrl: string, winner: string): string {
  const text = `The Assembly has concluded. ${winner} Victory! Check out the match summary:`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
}
