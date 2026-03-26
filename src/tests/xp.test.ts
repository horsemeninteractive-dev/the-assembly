import { describe, it, expect } from 'vitest';
import { getLevelFromXp, getXpForNextLevel, calculateXpGain } from '../lib/xp';

describe('XP Logic', () => {
  describe('calculateXpGain', () => {
    it('returns base XP for playing', () => {
      expect(calculateXpGain({ win: false, kills: 0 })).toBe(50);
    });

    it('adds 100 XP for a win', () => {
      expect(calculateXpGain({ win: true, kills: 0 })).toBe(150);
    });

    it('adds 50 XP per kill', () => {
      expect(calculateXpGain({ win: false, kills: 2 })).toBe(150);
      expect(calculateXpGain({ win: true, kills: 2 })).toBe(250);
    });
  });

  describe('leveling logic', () => {
    it('returns level 1 for 0 XP', () => {
      expect(getLevelFromXp(0)).toBe(1);
    });

    it('returns level 2 after exceeding BASE_XP', () => {
      // level 1 needs 600 XP (floor(600 * 1.04^0))
      expect(getLevelFromXp(599)).toBe(1);
      expect(getLevelFromXp(600)).toBe(2);
    });

    it('calculates correct XP needed for next level', () => {
      // level 1: 600
      // level 2: floor(600 * 1.04^1) = 624
      expect(getXpForNextLevel(1)).toBe(600);
      expect(getXpForNextLevel(2)).toBe(624);
    });
  });
});
