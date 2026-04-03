import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '../../utils/utils';
import { ClanEmblem as ClanEmblemType } from '../../../shared/types';

export const CLAN_ICON_IDS = [
  'Shield', 'Sword', 'Scale', 'Clover', 'Zap', 'Flame', 'Droplets', 'Wind',
  'Sun', 'Moon', 'Star', 'Crown', 'Lock', 'Key', 'Eye', 'Heart',
  'Ghost', 'Skull', 'Bug', 'Flag', 'Anchor', 'Bird', 'Compass', 'Globe', 'Target'
];

interface ClanEmblemProps {
  emblem: ClanEmblemType;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ClanEmblem: React.FC<ClanEmblemProps> = ({ emblem, size = 'md', className }) => {
  const IconComponent = (Icons as any)[emblem.iconId] || Icons.Shield;
  
  const sizeClasses = {
    xs: 'w-6 h-6 p-1',
    sm: 'w-8 h-8 p-1.5',
    md: 'w-11 h-11 p-2',
    lg: 'w-16 h-16 p-3',
    xl: 'w-24 h-24 p-5',
  };

  const iconSizes = {
    xs: 12,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  };

  return (
    <div 
      className={cn('rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-white/5', sizeClasses[size], className)}
      style={{ backgroundColor: emblem.bgColor }}
    >
      <IconComponent 
        size={iconSizes[size]} 
        style={{ color: emblem.iconColor }} 
        strokeWidth={2.5}
      />
    </div>
  );
};
