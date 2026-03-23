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

  if (url.startsWith('http')) {
    const base = Capacitor.isNativePlatform() ? 'https://theassembly.web.app' : window.location.origin;
    const proxyBase = base + '/proxy?url=';
    return `${proxyBase}${encodeURIComponent(url)}`;
  }
  
  return url;
}
