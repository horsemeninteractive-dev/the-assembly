import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  AlertCircle, 
  EyeOff, 
  RotateCw, 
  Zap, 
  Shield, 
  UserMinus, 
  HelpCircle,
  Scale,
  Skull
} from 'lucide-react';
import { EventCard, GameState, EventCardId } from '../../../shared/types';
import { cn } from '../../utils/utils';

interface CrisisAnimationProps {
  gameState: GameState;
  activeEvent: EventCard;
  playSound: (key: string) => void;
  onComplete: () => void;
}

const getEventIcon = (id: EventCardId) => {
  const iconClass = "w-10 h-10 sm:w-12 h-12";
  switch (id) {
    case 'state_of_emergency': return <AlertCircle className={iconClass} />;
    case 'blackout': return <EyeOff className={iconClass} />;
    case 'snap_election': return <RotateCw className={iconClass} />;
    case 'iron_mandate': return <Zap className={iconClass} />;
    case 'open_session': return <Scale className={iconClass} />;
    case 'censure_motion': return <UserMinus className={iconClass} />;
    case 'veiled_proceedings': return <Shield className={iconClass} />;
    case 'dead_mans_gambit': return <HelpCircle className={iconClass} />;
    case 'double_or_nothing': return <Zap className={iconClass} />;
    default: return <AlertCircle className={iconClass} />;
  }
};

const getEventTheme = (id: EventCardId) => {
  switch (id) {
    case 'state_of_emergency': return 'border-red-500 bg-red-950/90 text-red-100 shadow-red-500/20';
    case 'blackout': return 'border-zinc-500 bg-zinc-950/90 text-zinc-100 shadow-zinc-500/20';
    case 'snap_election': return 'border-purple-500 bg-purple-950/90 text-purple-100 shadow-purple-500/20';
    case 'iron_mandate': return 'border-yellow-500 bg-yellow-950/90 text-yellow-100 shadow-yellow-500/20';
    case 'open_session': return 'border-blue-500 bg-blue-950/90 text-blue-100 shadow-blue-500/20';
    case 'censure_motion': return 'border-zinc-100 bg-zinc-900/90 text-zinc-100 shadow-zinc-100/10';
    case 'veiled_proceedings': return 'border-emerald-500 bg-emerald-950/90 text-emerald-100 shadow-emerald-500/20';
    case 'dead_mans_gambit': return 'border-cyan-500 bg-cyan-950/90 text-cyan-100 shadow-cyan-500/20';
    case 'double_or_nothing': return 'border-orange-500 bg-orange-950/90 text-orange-100 shadow-orange-500/20';
    default: return 'border-primary bg-card/95 text-primary shadow-primary/20';
  }
};

export const CrisisAnimation = ({ gameState, activeEvent, playSound, onComplete }: CrisisAnimationProps) => {
  const onCompleteRef = useRef(onComplete);
  const playSoundRef = useRef(playSound);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    playSoundRef.current = playSound;
  });

  useEffect(() => {
    if (playSoundRef.current) playSoundRef.current('crisis_alert');
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      key={`crisis-${activeEvent.id}-${gameState.round}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm"
    >
      <div className="perspective-1000">
        <motion.div
          initial={{ rotateY: 0, scale: 0.5, y: 200 }}
          animate={{
            rotateY: 180,
            scale: 1.1,
            y: 0,
            transition: { duration: 1, ease: 'backOut' },
          }}
          exit={{
            y: -500,
            scale: 0.3,
            opacity: 0,
            rotateZ: 15,
            transition: { duration: 0.8, ease: 'anticipate' },
          }}
          className="w-56 h-72 relative preserve-3d"
        >
          {/* Card Back */}
          <div className="absolute inset-0 bg-card border-4 border-strong rounded-3xl flex flex-col items-center justify-center backface-hidden shadow-2xl">
             <div className="w-12 h-12 rounded-full border-2 border-ghost/20 flex items-center justify-center mb-3">
                <Skull className="w-6 h-6 text-ghost/40" />
             </div>
             <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ghost/40 text-center px-4">The Assembly<br/>Crisis Deck</span>
          </div>

          {/* Card Front */}
          <div
            className={cn(
              'absolute inset-0 rounded-3xl border-4 flex flex-col items-center p-5 backface-hidden rotate-y-180 shadow-2xl',
              getEventTheme(activeEvent.id)
            )}
          >
            <div className="mb-3 mt-1 p-2.5 rounded-2xl bg-black/20 border border-white/10 shrink-0">
               {getEventIcon(activeEvent.id)}
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-hidden">
              <h2 className="text-lg font-serif italic text-center mb-1.5 leading-tight px-1 shrink-0">
                {activeEvent.name}
              </h2>
              
              <div className="w-8 h-0.5 bg-current/20 mb-2.5 shrink-0" />
              
              <div className="w-full px-2 flex-1 flex items-center justify-center">
                <p className="text-[11px] sm:text-[12px] text-center leading-snug font-sans opacity-95 italic">
                  "{activeEvent.description}"
                </p>
              </div>
            </div>

            <div className="mt-3 text-[7px] font-mono uppercase tracking-widest opacity-40 shrink-0">
              Global Modifier • Round {gameState.phase === 'Event_Reveal' ? gameState.round + 1 : gameState.round}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [1, 2, 2.5], opacity: [0, 0.4, 0] }}
        transition={{ delay: 0.5, duration: 1.5, ease: 'easeOut' }}
        className={cn(
          'absolute w-[400px] h-[400px] rounded-full blur-[80px] -z-10',
          activeEvent.id === 'state_of_emergency' ? 'bg-red-500/40' : 'bg-primary/20'
        )}
      />
    </motion.div>
  );
};
