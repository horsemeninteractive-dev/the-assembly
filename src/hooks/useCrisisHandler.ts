import { useState, useEffect, useRef } from 'react';
import { GameState } from '../../shared/types';

interface UseCrisisHandlerProps {
  gameState: GameState;
}

export function useCrisisHandler({ gameState }: UseCrisisHandlerProps) {
  const [showCrisisAnim, setShowCrisisAnim] = useState(false);
  const lastSeenCrisisIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gameState.activeEventCard) {
      lastSeenCrisisIdRef.current = undefined;
      return;
    }

    const key = `${gameState.activeEventCard.id}-${gameState.round}`;
    if (key !== lastSeenCrisisIdRef.current) {
      lastSeenCrisisIdRef.current = key;
      setShowCrisisAnim(true);
      
      // Auto-hide after 5 seconds to let players see the board
      const timer = setTimeout(() => {
        setShowCrisisAnim(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [gameState.activeEventCard, gameState.round]);

  return {
    showCrisisAnim,
    setShowCrisisAnim,
  };
}
