import React from 'react';
import * as Icons from 'lucide-react';
import { Check, X } from 'lucide-react';
import { cn } from '../../utils/utils';
import { CLAN_ICON_IDS, ClanEmblem } from './ClanEmblem';
import { ClanEmblem as ClanEmblemType } from '../../../shared/types';

const ICON_COLORS = [
  '#FFFFFF', '#FFD700', '#FF4500', '#FF1493', '#9400D3', '#1E90FF', '#00CED1', '#32CD32', '#ADFF2F', '#A9A9A9', '#8B4513'
];

const BG_COLORS = [
  '#2A2A2A', '#121212', '#4B0082', '#00008B', '#006400', '#8B0000', '#DAA520', '#2F4F4F', '#191970', '#800080', '#000000'
];

interface ClanEmblemPickerProps {
  value: ClanEmblemType;
  onChange: (value: ClanEmblemType) => void;
}

export const ClanEmblemPicker: React.FC<ClanEmblemPickerProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-6">
      {/* 
        Preview Row 
      */}
      <div className="flex items-center gap-4 p-4 bg-elevated rounded-2xl border border-subtle">
        <ClanEmblem emblem={value} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary uppercase tracking-wide">Emblem Preview</p>
          <p className="text-xs text-ghost">Choose icon, color and background style.</p>
        </div>
      </div>

      {/* 
        Icon Selection 
      */}
      <div className="space-y-2">
        <label className="text-xs text-ghost font-medium uppercase tracking-wide">Icon</label>
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
          {CLAN_ICON_IDS.map(id => {
            const Icon = (Icons as any)[id] || Icons.Shield;
            return (
              <button
                key={id}
                onClick={() => onChange({ ...value, iconId: id })}
                className={cn(
                  'aspect-square rounded-xl border flex items-center justify-center transition-all',
                  value.iconId === id
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-subtle bg-elevated hover:border-default text-muted'
                )}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 
        Icon Color 
      */}
      <div className="space-y-2">
        <label className="text-xs text-ghost font-medium uppercase tracking-wide">Icon Color</label>
        <div className="flex flex-wrap gap-2">
          {ICON_COLORS.map(color => (
            <button
              key={color}
              onClick={() => onChange({ ...value, iconColor: color })}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center',
                value.iconColor === color ? 'border-white scale-110 shadow-lg' : 'border-black/50'
              )}
              style={{ backgroundColor: color }}
            >
              {value.iconColor === color && <Check className="w-4 h-4 text-deep pointer-events-none" />}
            </button>
          ))}
          {/* Custom via input */}
          <input 
            type="color" 
            value={value.iconColor} 
            onChange={(e) => onChange({ ...value, iconColor: e.target.value })}
            className="w-8 h-8 rounded-full border border-default p-0 bg-transparent overflow-hidden cursor-pointer"
          />
        </div>
      </div>

      {/* 
        Background Color 
      */}
      <div className="space-y-2">
        <label className="text-xs text-ghost font-medium uppercase tracking-wide">Background</label>
        <div className="flex flex-wrap gap-2">
          {BG_COLORS.map(color => (
            <button
              key={color}
              onClick={() => onChange({ ...value, bgColor: color })}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center',
                value.bgColor === color ? 'border-white scale-110 shadow-lg' : 'border-black/50'
              )}
              style={{ backgroundColor: color }}
            >
              {value.bgColor === color && <Check className="w-4 h-4 text-white pointer-events-none shadow-sm" />}
            </button>
          ))}
          {/* Custom via input */}
          <input 
            type="color" 
            value={value.bgColor} 
            onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
            className="w-8 h-8 rounded-full border border-default p-0 bg-transparent overflow-hidden cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
