import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The production server URL — used by native builds so relative API paths
// resolve to the real backend instead of the local Capacitor file server.
const SERVER_URL = 'https://the-assembly-874660478794.us-west1.run.app';

/**
 * Returns the correct base URL for API calls.
 * On native Android, fetch('/api/rooms') resolves against capacitor://localhost
 * which doesn't host our backend. This function prefixes the production URL.
 * On web, it returns '' so relative paths work as usual.
 */
export function apiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `${SERVER_URL}${path}`;
  }
  return path;
}

export function getProxiedUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url;

  // If it's already proxied, don't proxy again
  if (url.includes('/proxy?url=')) return url;

  // Proxy is only needed for Discord Activity context to bypass their strict CSP/proxy rules.
  // We detect Discord by checking for frame_id or instance_id in the URL.
  const urlParams = new URLSearchParams(window.location.search);
  const isDiscord = urlParams.has('frame_id') || urlParams.has('instance_id');

  if (url.startsWith('http') && isDiscord) {
    const base = Capacitor.isNativePlatform()
      ? 'https://theassembly.web.app'
      : window.location.origin;
    const proxyBase = base + '/proxy?url=';
    return `${proxyBase}${encodeURIComponent(url)}`;
  }

  return url;
}
