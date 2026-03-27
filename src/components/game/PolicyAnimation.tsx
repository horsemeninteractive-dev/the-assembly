import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Scale, Eye } from 'lucide-react';
import { GameState } from '../../types';
import { getPolicyStyles } from '../../lib/cosmetics';
import { cn } from '../../lib/utils';

interface PolicyAnimationProps {
  gameState: GameState;
  show: boolean;
  playSound: (key: string) => void;
}

export const PolicyAnimation = ({ gameState, show, playSound }: PolicyAnimationProps) => {
  // Use a ref for the callback so it never causes the effect to re-run
  const playSoundRef = React.useRef(playSound);
  React.useEffect(() => {
    playSoundRef.current = playSound;
  });

  // Track which policy we already played a sound for to prevent duplicates
  const playedKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!show || !gameState.lastEnactedPolicy) return;
    // Build a stable key: type + policyTrack length acts as a unique identifier per reveal
    const key = `${gameState.lastEnactedPolicy.type}-${gameState.civilDirectives}-${gameState.stateDirectives}`;
    if (playedKeyRef.current === key) return; // already played for this reveal
    playedKeyRef.current = key;
    playSoundRef.current(
      gameState.lastEnactedPolicy.type === 'Civil' ? 'reveal_civil' : 'reveal_state'
    );
    // Only react to show toggling on/off and the policy identity — NOT playSound
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, gameState.lastEnactedPolicy, gameState.civilDirectives, gameState.stateDirectives]);

  return (
    <AnimatePresence>
      {show && gameState.lastEnactedPolicy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none bg-black/70 backdrop-blur-sm"
        >
          <div className="perspective-1000">
            <motion.div
              initial={{ rotateY: 0, scale: 0.5, y: 150 }}
              animate={{
                rotateY: 180,
                scale: 1.2,
                y: 0,
                transition: { duration: 1, ease: 'backOut' },
              }}
              exit={{
                y: -400,
                scale: 0.2,
                opacity: 0,
                transition: { duration: 0.8, ease: 'anticipate' },
              }}
              className="w-48 h-64 relative preserve-3d"
            >
              <div className="absolute inset-0 bg-card border-4 border-strong rounded-2xl flex items-center justify-center backface-hidden shadow-2xl">
                <Shield className="w-12 h-12 text-ghost" />
              </div>
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl border-4 flex flex-col items-center justify-center gap-4 backface-hidden rotate-y-180 shadow-[0_0_30px_rgba(0,0,0,0.5)]',
                  getPolicyStyles(
                    gameState.players.find((p) => p.id === gameState.lastEnactedPolicy?.playerId)
                      ?.activePolicyStyle,
                    gameState.lastEnactedPolicy.type
                  )
                )}
              >
                {gameState.lastEnactedPolicy.type === 'Civil' ? (
                  <Scale className="w-16 h-16 drop-shadow-md" />
                ) : (
                  <Eye className="w-16 h-16 drop-shadow-md" />
                )}
                <span className="text-sm font-mono uppercase tracking-[0.2em] font-bold text-center px-4">
                  {gameState.lastEnactedPolicy.type === 'Civil'
                    ? 'CIVIL DIRECTIVE'
                    : 'STATE DIRECTIVE'}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Pulsing Blur Background */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5, 2], opacity: [0, 0.8, 0] }}
            transition={{ delay: 0.6, duration: 1.5, ease: 'easeOut' }}
            className={cn(
              'absolute w-96 h-96 rounded-full blur-3xl -z-10',
              gameState.lastEnactedPolicy.type === 'Civil' ? 'bg-blue-500/60' : 'bg-red-500/60'
            )}
          />

          {/* Pulsing Ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, borderWidth: '10px' }}
            animate={{
              scale: [0.8, 2, 3],
              opacity: [0, 1, 0],
              borderWidth: ['10px', '2px', '0px'],
            }}
            transition={{ delay: 0.6, duration: 1.2, ease: 'easeOut' }}
            className={cn(
              'absolute w-64 h-64 rounded-full -z-10 bg-transparent blur-[2px]',
              gameState.lastEnactedPolicy.type === 'Civil' ? 'border-blue-400' : 'border-red-500'
            )}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
