import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown } from 'lucide-react';
import { Player } from '../../../shared/types';
import { cn, getProxiedUrl } from '../../utils/utils';
import { getFrameStyles } from '../../utils/cosmetics';

interface PresidentPickAnimationProps {
  players: Player[];
  presidentId: string;
  playSound: (key: string) => void;
  onComplete: () => void;
}

/**
 * Roulette-style animation that cycles through all player cards and
 * settles on the randomly chosen first president.
 */
export const PresidentPickAnimation: React.FC<PresidentPickAnimationProps> = ({
  players,
  presidentId,
  playSound,
  onComplete,
}) => {
  const alivePlayers = players.filter((p) => p.isAlive);
  const presidentIdx = alivePlayers.findIndex((p) => p.id === presidentId);
  const safePresidentIdx = presidentIdx === -1 ? 0 : presidentIdx;

  // We'll spin through all players several times then land on the president
  const SPINS = 3; // full rotations before slowing
  const TOTAL_STEPS = SPINS * alivePlayers.length + safePresidentIdx;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<'spinning' | 'reveal' | 'done'>('spinning');
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCompleteRef = useRef(onComplete);
  const playSoundRef = useRef(playSound);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    playSoundRef.current = playSound;
  });

  useEffect(() => {
    if (alivePlayers.length === 0) {
      onCompleteRef.current();
      return;
    }

    playSoundRef.current('click');

    // Delay schedule: fast at start, decelerates at end
    const scheduleNext = () => {
      const step = stepRef.current;
      const totalSteps = TOTAL_STEPS;
      const progress = step / totalSteps;

      // Interpolate delay: 60ms fast → 400ms slow
      const minDelay = 60;
      const maxDelay = 400;
      let delay: number;
      if (progress < 0.6) {
        delay = minDelay;
      } else {
        // Ease out deceleration in the final 40%
        const t = (progress - 0.6) / 0.4;
        delay = minDelay + (maxDelay - minDelay) * (t * t);
      }

      timerRef.current = setTimeout(() => {
        stepRef.current++;
        const idx = stepRef.current % alivePlayers.length;
        setCurrentIdx(idx);

        if (idx % alivePlayers.length === safePresidentIdx % alivePlayers.length) {
          // Play a tick when we pass the president slot
          if (stepRef.current < TOTAL_STEPS - 1) {
            playSoundRef.current('hover');
          }
        } else {
          playSoundRef.current('hover');
        }

        if (stepRef.current >= TOTAL_STEPS) {
          // Landed on president
          setPhase('reveal');
          playSoundRef.current('vote_cast');
          timerRef.current = setTimeout(() => {
            setPhase('done');
            timerRef.current = setTimeout(() => {
              onCompleteRef.current();
            }, 600);
          }, 2500);
        } else {
          scheduleNext();
        }
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const president = alivePlayers[safePresidentIdx];

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
        >
          {/* Header */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8 text-center"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 mb-1">
              The Assembly
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif italic text-white">
              Selecting First President
            </h2>
          </motion.div>

          {/* Roulette strip — shows current highlighted card large + neighbours small */}
          <div className="relative flex items-center gap-3 h-[18vh] sm:h-[22vh]">
            {[-2, -1, 0, 1, 2].map((offset) => {
              const idx =
                ((currentIdx + offset) % alivePlayers.length + alivePlayers.length) %
                alivePlayers.length;
              const p = alivePlayers[idx];
              const isCentre = offset === 0;
              const isPresident = p.id === presidentId && phase === 'reveal';

              return (
                <motion.div
                  key={`${p.id}-${offset}`}
                  animate={{
                    scale: isCentre ? (phase === 'reveal' ? 1.25 : 1.1) : Math.max(0.6, 1 - Math.abs(offset) * 0.2),
                    opacity: isCentre ? 1 : Math.max(0.25, 1 - Math.abs(offset) * 0.4),
                    filter: isCentre ? 'blur(0px)' : `blur(${Math.abs(offset) * 1.5}px)`,
                  }}
                  transition={{ duration: 0.08, ease: 'easeOut' }}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-2xl border-2 cursor-default overflow-hidden shrink-0',
                    'w-[12vw] sm:w-[10vw] h-full',
                    isCentre && !isPresident &&
                      'border-white/40 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.15)]',
                    isCentre && isPresident &&
                      'border-yellow-400 bg-yellow-900/30 shadow-[0_0_50px_rgba(234,179,8,0.5)]',
                    !isCentre && 'border-white/10 bg-white/5'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'relative rounded-xl overflow-hidden shrink-0',
                      'w-[7vh] h-[7vh] sm:w-[8vh] sm:h-[8vh]',
                      p.activeFrame && getFrameStyles(p.activeFrame)
                    )}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={getProxiedUrl(p.avatarUrl)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center text-2xl select-none">
                        👤
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <p
                    className={cn(
                      'mt-1.5 px-1 font-thematic text-center leading-tight truncate w-full',
                      'text-[8px] sm:text-[10px]',
                      isCentre ? 'text-white' : 'text-white/50'
                    )}
                  >
                    {p.name.replace(' (AI)', '')}
                  </p>

                  {/* Crown on reveal */}
                  {isPresident && (
                    <motion.div
                      initial={{ scale: 0, y: -10, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2"
                    >
                      <Crown className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}

            {/* Centre selector brackets */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[12vw] sm:w-[10vw] pointer-events-none">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/60 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/60 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/60 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/60 rounded-br-sm" />
            </div>
          </div>

          {/* Reveal text */}
          <AnimatePresence>
            {phase === 'reveal' && (
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
                className="mt-8 text-center"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-yellow-400/70 mb-1">
                  First President
                </p>
                <h3 className="text-2xl sm:text-3xl font-serif italic text-yellow-300 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                  {president.name.replace(' (AI)', '')}
                </h3>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanning pulse line */}
          <motion.div
            animate={{ x: ['-100vw', '100vw'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
            className="absolute h-px w-[200vw] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
