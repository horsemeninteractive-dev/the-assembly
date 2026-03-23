import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProxiedUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url;
  
  // If it's already proxied, don't proxy again
  if (url.includes('/proxy?url=')) return url;

  // Proxy is only needed for Discord Activity context to bypass their strict CSP/proxy rules.
  // We detect Discord by checking for frame_id or instance_id in the URL.
  const urlParams = new URLSearchParams(window.location.search);
  const isDiscord = urlParams.has("frame_id") || urlParams.has("instance_id");

  if (url.startsWith('http') && isDiscord) {
    const base = Capacitor.isNativePlatform() ? 'https://theassembly.web.app' : window.location.origin;
    const proxyBase = base + '/proxy?url=';
    return `${proxyBase}${encodeURIComponent(url)}`;
  }
  
  return url;
}
