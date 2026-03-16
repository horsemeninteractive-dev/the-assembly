import React from 'react';
import { Zap } from 'lucide-react';

interface UpdateBannerProps {
  visible: boolean;
}

export const UpdateBanner = ({ visible }: UpdateBannerProps) => {
  if (!visible) return null;
  return (
    <div className="relative z-[9999] flex items-center justify-between gap-4 bg-yellow-500 text-black px-4 py-2.5 shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap className="w-4 h-4 shrink-0" />
        <span>A new version of The Assembly is available. Please refresh after this round.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 px-4 py-1.5 bg-black text-white text-xs font-mono uppercase tracking-widest rounded-lg hover:bg-gray-900 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
};
