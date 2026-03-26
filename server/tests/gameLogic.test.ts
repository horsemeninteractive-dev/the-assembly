import { describe, it, expect } from 'vitest';
import { computeEloChange } from '../gameEngine';
import { createDeck } from '../utils';
import { assignRoles, getExecutiveAction } from '../gameRules';
import { GameState } from '../../src/types';

describe('Game Logic Pure Functions', () => {
  describe('computeEloChange', () => {
    it('uses K-factor 32 for provisional players (< 30 games)', () => {
      // player 1000, opponent 1000, won. expected = 0.5. 32 * (1 - 0.5) = 16
      expect(computeEloChange(1000, 1000, true, 29)).toBe(16);
      // player 1000, opponent 1000, lost. 32 * (0 - 0.5) = -16
      expect(computeEloChange(1000, 1000, false, 29)).toBe(-16);
    });

    it('uses K-factor 20 for established players (>= 30 games)', () => {
      // player 1000, opponent 1000, won. expected = 0.5. 20 * (1 - 0.5) = 10
      expect(computeEloChange(1000, 1000, true, 30)).toBe(10);
    });

    it('returns higher gains when winning against stronger opponents', () => {
      const normalGain = computeEloChange(1000, 1000, true, 30); // 10
      const underdogGain = computeEloChange(1000, 1200, true, 30);
      expect(underdogGain).toBeGreaterThan(normalGain);
    });

    it('returns smaller losses when losing to stronger opponents', () => {
      const normalLoss = computeEloChange(1000, 1000, false, 30); // -10
      const understoodLoss = computeEloChange(1000, 1200, false, 30);
      expect(understoodLoss).toBeGreaterThan(normalLoss); // e.g. -5 is > -10
    });
  });

  describe('createDeck', () => {
    it('creates a deck with exactly 6 Civil and 11 State policies', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(17);
      expect(deck.filter(p => p === 'Civil')).toHaveLength(6);
      expect(deck.filter(p => p === 'State')).toHaveLength(11);
    });
  });

  describe('assignRoles', () => {
    const testCases = [
      { n: 5, civil: 3, state: 1, overseer: 1 },
      { n: 6, civil: 4, state: 1, overseer: 1 },
      { n: 7, civil: 4, state: 2, overseer: 1 },
      { n: 8, civil: 5, state: 2, overseer: 1 },
      { n: 9, civil: 5, state: 3, overseer: 1 },
      { n: 10, civil: 6, state: 3, overseer: 1 },
    ];

    testCases.forEach(({ n, civil, state, overseer }) => {
      it(`assigns correct roles for ${n} players`, () => {
        const roles = assignRoles(n);
        expect(roles).toHaveLength(n);
        expect(roles.filter(r => r === 'Civil')).toHaveLength(civil);
        expect(roles.filter(r => r === 'State')).toHaveLength(state);
        expect(roles.filter(r => r === 'Overseer')).toHaveLength(overseer);
      });
    });
  });

  describe('getExecutiveAction', () => {
    const mockState = (numPlayers: number, stateDirectives: number): GameState => ({
      players: Array(numPlayers).fill({}),
      stateDirectives,
    } as GameState);

    it('returns PolicyPeek for 3rd State directive (5-6 players)', () => {
      expect(getExecutiveAction(mockState(5, 3))).toBe('PolicyPeek');
      expect(getExecutiveAction(mockState(6, 3))).toBe('PolicyPeek');
    });

    it('returns Investigate for 2nd State directive (7-8 players)', () => {
      expect(getExecutiveAction(mockState(7, 2))).toBe('Investigate');
      expect(getExecutiveAction(mockState(8, 2))).toBe('Investigate');
    });

    it('returns Investigate for 1st items (9-10 players)', () => {
      expect(getExecutiveAction(mockState(9, 1))).toBe('Investigate');
      expect(getExecutiveAction(mockState(10, 1))).toBe('Investigate');
    });

    it('returns SpecialElection for 3rd items (7-10 players)', () => {
      expect(getExecutiveAction(mockState(7, 3))).toBe('SpecialElection');
      expect(getExecutiveAction(mockState(10, 3))).toBe('SpecialElection');
    });

    it('returns Execution for 4th and 5th items for all counts', () => {
      [5, 8, 10].forEach(n => {
        expect(getExecutiveAction(mockState(n, 4))).toBe('Execution');
        expect(getExecutiveAction(mockState(n, 5))).toBe('Execution');
      });
    });

    it('returns None for other combinations', () => {
      expect(getExecutiveAction(mockState(5, 1))).toBe('None');
      expect(getExecutiveAction(mockState(5, 2))).toBe('None');
      expect(getExecutiveAction(mockState(5, 6))).toBe('None');
    });
  });
});
