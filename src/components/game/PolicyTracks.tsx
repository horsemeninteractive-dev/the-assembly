import React from 'react';
import { Scale, Eye, Search, Zap, Target, Trophy, Layers, Trash2 } from 'lucide-react';
import { GameState } from '../../types';
import { cn } from '../../lib/utils';
import { User as UserIcon } from 'lucide-react';
import { getProxiedUrl } from '../../lib/utils';

interface PolicyTracksProps {
  gameState: GameState;
}

export const PolicyTracks = ({ gameState }: PolicyTracksProps) => {
  const numPlayers = gameState.players.length;

  // slotIndex here is the directive number (1-6), but visually the track is reversed (6 on left, 1 on right)
  const getStatePower = (slotIndex: number) => {
    if (numPlayers <= 6) {
      if (slotIndex === 3) return { power: 'Peek', description: 'President previews top 3 directives', Icon: Eye };
      if (slotIndex === 4 || slotIndex === 5) return { power: 'Kill', description: 'President executes a player', Icon: Target };
    } else if (numPlayers <= 8) {
      if (slotIndex === 2) return { power: 'Inv', description: "President investigates a player's party", Icon: Search };
      if (slotIndex === 3) return { power: 'Spec', description: 'President chooses next candidate', Icon: Zap };
      if (slotIndex === 4 || slotIndex === 5) return { power: 'Kill', description: 'President executes a player', Icon: Target };
    } else {
      if (slotIndex === 1 || slotIndex === 2) return { power: 'Inv', description: "President investigates a player's party", Icon: Search };
      if (slotIndex === 3) return { power: 'Spec', description: 'President chooses next candidate', Icon: Zap };
      if (slotIndex === 4 || slotIndex === 5) return { power: 'Kill', description: 'President executes a player', Icon: Target };
    }
    if (slotIndex === 6) return { power: 'Win', description: 'State wins immediately', Icon: Trophy };
    return null;
  };

  // Visual slot order for state track: reversed (slot 6 is leftmost, slot 1 is rightmost)
  // stateVisualSlots[0] = directive number 6, stateVisualSlots[5] = directive number 1
  const stateVisualSlots = [6, 5, 4, 3, 2, 1];

  return (
    <div className="p-[1.5vh] grid grid-cols-[1fr_auto_1fr] gap-[1.5vh] bg-surface-glass border-b border-subtle shrink-0 items-start relative z-40">
      {/* Civil Track */}
      <div className="space-y-[0.5vh]">
        <div className="flex items-center justify-between uppercase tracking-widest font-mono text-blue-400/70">
          <div className="flex items-center gap-1 text-responsive-xs">
            <Scale className="w-[1.4vh] h-[1.4vh]" />
            <span>Civil</span>
          </div>
          <span className="text-[1.2vh] font-bold text-blue-400">{gameState.civilDirectives}</span>
        </div>
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => {
            const isCivilWin = i === 4;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 h-[3vh] rounded-sm border transition-all duration-500 relative group',
                  isCivilWin ? 'cursor-pointer' : '',
                  i < gameState.civilDirectives
                    ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                    : 'bg-elevated border-subtle'
                )}
              >
                {isCivilWin && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">
                    <Trophy className="w-[1.2vh] h-[1.2vh] text-blue-400" />
                  </div>
                )}
                {isCivilWin && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-32 p-2 bg-surface border border-default rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[200] shadow-2xl">
                    <div className="text-responsive-xs font-mono text-blue-400 uppercase mb-1">Win</div>
                    <div className="text-[7px] text-tertiary leading-tight">Civil wins immediately</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Deck / Discard Counter */}
      <div className="flex flex-col items-center justify-center gap-[0.8vh] px-[1vh] border-x border-subtle/50 h-[5vh] self-center">
        <div className="flex flex-col items-center gap-0.5 group relative">
          <Layers className="w-[1.2vh] h-[1.2vh] text-muted" />
          <span className="text-[9px] font-mono text-primary leading-none">{gameState.deck.length}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-black text-[8px] font-mono text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
            DECK
          </div>
        </div>
        <div className="w-[1.5vh] h-px bg-card" />
        <div className="flex flex-col items-center gap-0.5 group relative">
          <Trash2 className="w-[1.2vh] h-[1.2vh] text-muted" />
          <span className="text-[9px] font-mono text-muted leading-none">{gameState.discard.length}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-black text-[8px] font-mono text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            DISCARD
          </div>
        </div>
      </div>

      {/* State Track */}
      <div className="space-y-[0.5vh]">
        <div className="flex items-center justify-between uppercase tracking-widest font-mono text-red-500/70">
          <span className="text-[1.2vh] font-bold text-red-500">{gameState.stateDirectives}</span>
          <div className="flex items-center gap-1 text-responsive-xs">
            <span>State</span>
            <Eye className="w-[1.4vh] h-[1.4vh]" />
          </div>
        </div>
        <div className="flex gap-1">
          {stateVisualSlots.map((directiveNum, visualIndex) => {
            const slot = getStatePower(directiveNum);
            const Icon = slot?.Icon ?? Eye;
            // A slot is "filled" (active) when stateDirectives >= directiveNum
            const isFilled = gameState.stateDirectives >= directiveNum;
            // Danger styling for directive numbers >= 4
            const isDanger = directiveNum >= 4;
            // Tooltip for leftmost slots should open to the right to stay in view
            const tooltipAlign = visualIndex < 2 ? 'left-0 -translate-x-0' : 'left-1/2 -translate-x-1/2';
            return (
              <div
                key={directiveNum}
                className={cn(
                  'flex-1 h-[3vh] rounded-sm border transition-all duration-500 relative group',
                  slot ? 'cursor-pointer' : '',
                  isFilled
                    ? 'bg-red-900/40 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                    : isDanger
                      ? 'bg-red-900/10 border-red-900/30'
                      : 'bg-elevated border-subtle'
                )}
                onClick={(e) => slot && e.currentTarget.classList.toggle('tooltip-open')}
              >
                {slot && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">
                    <Icon className="w-[1.2vh] h-[1.2vh] text-red-500" />
                  </div>
                )}
                {slot && (
                  <div className={cn(
                    'absolute top-full mt-2 w-32 p-2 bg-surface border border-default rounded-lg opacity-0 group-hover:opacity-100 group-[.tooltip-open]:opacity-100 pointer-events-none transition-opacity z-[200] shadow-2xl',
                    tooltipAlign
                  )}>
                    <div className="text-responsive-xs font-mono text-red-500 uppercase mb-1">{slot.power}</div>
                    <div className="text-[7px] text-tertiary leading-tight">{slot.description}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spectators */}
      {gameState.spectators.length > 0 && (
        <div className="col-span-3 h-[2.5vh] flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <Eye className="w-[1.2vh] h-[1.2vh] text-ghost" />
            <span className="text-responsive-xs font-mono uppercase tracking-widest text-ghost">
              Spectators ({gameState.spectators.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {gameState.spectators.map(s => (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <div className="w-[1.5vh] h-[1.5vh] rounded-full bg-card overflow-hidden border border-default">
                  {s.avatarUrl
                    ? <img src={getProxiedUrl(s.avatarUrl)} alt={s.name} className="w-full h-full object-cover" />
                    : <UserIcon className="w-[1vh] h-[1vh] text-ghost m-auto" />}
                </div>
                <span className="text-responsive-xs text-muted">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Election Tracker */}
      <div className="col-span-3 h-[3vh] flex items-center justify-center gap-3 bg-elevated -mx-4 -mb-4 px-4 border-t border-subtle">
        <span className="text-responsive-xs uppercase tracking-[0.2em] text-ghost font-mono">Election Tracker</span>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={cn(
                'w-[0.8vh] h-[0.8vh] rounded-full border transition-all duration-300',
                gameState.electionTracker === i
                  ? 'bg-white border-white scale-125 shadow-[0_0_5px_white]'
                  : 'border-default bg-transparent'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
