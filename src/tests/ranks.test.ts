import { describe, it, expect } from 'vitest';
import { getRankTier, getRankLabel } from '../lib/ranks';

describe('Rank System Logic', () => {
  describe('getRankTier', () => {
    it('returns Bronze for low ELO', () => {
      const tier = getRankTier(500);
      expect(tier.name).toBe('Bronze');
      expect(tier.icon).toBe('🥉');
    });

    it('returns Silver for ELO 1000', () => {
      const tier = getRankTier(1000);
      expect(tier.name).toBe('Silver');
      expect(tier.minElo).toBe(1000);
    });

    it('returns Diamond for high ELO', () => {
      const tier = getRankTier(2000);
      expect(tier.name).toBe('Diamond');
      expect(tier.roman).toBe('');
    });

    it('calculates Roman subdivisions correctly', () => {
      // Bronze III: 0-333
      expect(getRankTier(100).roman).toBe('III');
      // Bronze II: 334-666
      expect(getRankTier(400).roman).toBe('II');
      // Bronze I: 667-999
      expect(getRankTier(800).roman).toBe('I');
    });

    it('handles boundary ELO values', () => {
      expect(getRankTier(999).name).toBe('Bronze');
      expect(getRankTier(1000).name).toBe('Silver');
      expect(getRankTier(1199).name).toBe('Silver');
      expect(getRankTier(1200).name).toBe('Gold');
    });
  });

  describe('getRankLabel', () => {
    it('formats labels with Roman numerals when applicable', () => {
      expect(getRankLabel(500)).toBe('Bronze II');
      expect(getRankLabel(1100)).toBe('Silver II');
      expect(getRankLabel(1300)).toBe('Gold II');
    });

    it('omits Roman numerals for Diamond', () => {
      expect(getRankLabel(1800)).toBe('Diamond');
    });
  });
});
