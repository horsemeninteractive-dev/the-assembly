import React from 'react';
import { Eye, Crown } from 'lucide-react';
import { cn } from '../lib/utils';

export const OverseerIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    <Eye className="w-full h-full" />
    <Crown className="absolute -top-[45%] left-1/2 -translate-x-1/2 w-[70%] h-[70%] text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
  </div>
);
