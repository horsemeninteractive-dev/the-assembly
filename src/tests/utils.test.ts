import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cn, apiUrl, getProxiedUrl } from '../lib/utils';
import { Capacitor } from '@capacitor/core';

// Mock Capacitor behavior
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe('Frontend Helpers (utils.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      location: {
        search: '',
        origin: 'https://test-app.com',
      },
    });
  });

  describe('cn', () => {
    it('merges tailwind classes properly', () => {
      const result = cn('bg-red-500', 'p-4', 'bg-blue-500');
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('bg-red-500');
    });
  });

  describe('apiUrl', () => {
    it('returns prefixed URL on native android', () => {
      (Capacitor.isNativePlatform as any).mockReturnValue(true);
      const url = apiUrl('/api/test');
      expect(url).toBe('https://the-assembly-874660478794.us-west1.run.app/api/test');
    });

    it('returns relative URL on web', () => {
      (Capacitor.isNativePlatform as any).mockReturnValue(false);
      const url = apiUrl('/api/test');
      expect(url).toBe('/api/test');
    });
  });

  describe('getProxiedUrl', () => {
    it('returns original URL if simple path', () => {
      expect(getProxiedUrl('/avatar.png')).toBe('/avatar.png');
    });

    it('proxies URLs when in Discord context', () => {
      vi.stubGlobal('window', {
        location: {
          search: '?frame_id=123',
          origin: 'https://test-app.com',
        },
      });

      const result = getProxiedUrl('http://external.com/pic.jpg');
      expect(result).toContain('/proxy?url=http%3A%2F%2Fexternal.com%2Fpic.jpg');
    });

    it('returns original URL if not in Discord context', () => {
      vi.stubGlobal('window', {
        location: {
          search: '',
          origin: 'https://test-app.com',
        },
      });
      const result = getProxiedUrl('http://external.com/pic.jpg');
      expect(result).toBe('http://external.com/pic.jpg');
    });
  });
});
