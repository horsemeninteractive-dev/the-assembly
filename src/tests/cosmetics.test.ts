import { describe, it, expect } from 'vitest';
import { getFrameStyles, getPolicyStyles, getVoteStyles, getRarity } from '../lib/cosmetics';

describe('Cosmetics System Logic', () => {
  describe('getFrameStyles', () => {
    it('returns empty string for unknown style', () => {
      expect(getFrameStyles('unknown-frame')).toBe('');
    });

    it('returns shadow styles for red-frame', () => {
      const styles = getFrameStyles('frame-red');
      expect(styles).toContain('shadow');
      expect(styles).toContain('rgba(239,68,68,0.5)');
    });

    it('returns animation for rainbow-frame', () => {
      const styles = getFrameStyles('frame-rainbow');
      expect(styles).toContain('animate-pulse');
    });
  });

  describe('getPolicyStyles', () => {
    it('returns distinct styles for Civil vs State', () => {
      const civil = getPolicyStyles('policy-modern', 'Civil');
      const state = getPolicyStyles('policy-modern', 'State');
      expect(civil).not.toBe(state);
      expect(civil).toContain('blue');
      expect(state).toContain('red');
    });

    it('handles blueprint mono styles', () => {
      const styles = getPolicyStyles('policy-blueprint', 'Civil');
      expect(styles).toContain('font-mono');
    });
  });

  describe('getVoteStyles', () => {
    it('returns empty default styles for undefined type', () => {
      expect(getVoteStyles('vote-wax', undefined)).toContain('bg-black');
    });

    it('returns wax styles for Aye', () => {
      const styles = getVoteStyles('vote-wax', 'Aye');
      expect(styles).toContain('bg-[#8b0000]');
    });

    it('returns distinct Aye vs Nay in neon style', () => {
      const aye = getVoteStyles('vote-neon', 'Aye');
      const nay = getVoteStyles('vote-neon', 'Nay');
      expect(aye).toContain('emerald');
      expect(nay).toContain('red');
    });
  });

  describe('getRarity', () => {
    it('returns common for price 0', () => {
      expect(getRarity(0).name).toBe('Common');
    });

    it('returns uncommon for price 500', () => {
        expect(getRarity(500).name).toBe('Uncommon');
    });

    it('returns epic for price 3000', () => {
        expect(getRarity(3000).name).toBe('Epic');
    });

    it('returns legendary for high price', () => {
        expect(getRarity(5000).name).toBe('Legendary');
    });
  });
});
