import React from 'react';
import { Eye, Crown } from 'lucide-react';
import { cn } from '../utils/utils';

export const OverseerIcon = ({ className }: { className?: string }) => (
  <div className={cn('relative flex items-center justify-center p-1', className)}>
    <svg 
      viewBox="0 0 24 24" 
      className="absolute inset-0 w-full h-full drop-shadow-[0_0_8px_currentColor]" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.2"
    >
      <path d="M12 2L22 12L12 22L2 12L12 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5L19 12L12 19L5 12L12 5" strokeOpacity="0.4" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <Eye className="w-[55%] h-[55%] drop-shadow-[0_0_4px_currentColor]" />
  </div>
);

export const BronzeBadge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <polygon points="12 2 22 7.5 22 16.5 12 22 2 16.5 2 7.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="12 4.5 19 8.5 19 15.5 12 19.5 5 15.5 5 8.5" fill="currentColor" fillOpacity="0.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const SilverBadge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 22S3 18 3 8V4L12 2L21 4V8C21 18 12 22 12 22Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 19.5S6 16 6 8.5V5.5L12 4L18 5.5V8.5C18 16 12 19.5 12 19.5Z" fill="currentColor" fillOpacity="0.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const GoldBadge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 22S3 18 3 8V4L12 2L21 4V8C21 18 12 22 12 22Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 19.5S6 16 6 8.5V5.5L12 4L18 5.5V8.5C18 16 12 19.5 12 19.5Z" fill="currentColor" fillOpacity="0.5" />
    <polygon points="12 6.5 13.5 10.5 17.5 11 14.5 14 15 18 12 16 9 18 9.5 14 6.5 11 10.5 10.5" fill="currentColor" />
  </svg>
);

export const PlatinumBadge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <polygon points="12 2 22 8 12 22 2 8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="12 4 19 8.5 12 19 5 8.5" fill="currentColor" fillOpacity="0.5" />
    <polygon points="12 6 16 9 12 15 8 9" fill="currentColor" />
  </svg>
);

export const DiamondBadge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 5L14 10L19 12L14 14L12 19L10 14L5 12L10 10L12 5Z" fill="currentColor" fillOpacity="0.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const RankIcon = ({ tier, className }: { tier: string, className?: string }) => {
  switch (tier) {
    case 'Bronze': return <BronzeBadge className={cn("text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]", className)} />;
    case 'Silver': return <SilverBadge className={cn("text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.5)]", className)} />;
    case 'Gold': return <GoldBadge className={cn("text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]", className)} />;
    case 'Platinum': return <PlatinumBadge className={cn("text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]", className)} />;
    case 'Diamond': return <DiamondBadge className={cn("text-blue-300 drop-shadow-[0_0_12px_rgba(147,197,253,0.8)] animate-pulse-slow", className)} />;
    default: return null;
  }
};


