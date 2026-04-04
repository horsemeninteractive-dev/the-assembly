import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Zap, Shield, EyeOff, Scale, UserMinus, RotateCw, HelpCircle } from 'lucide-react';
import { EventCard, EventCardId } from '../../../shared/types';
import { cn } from '../../utils/utils';

interface CrisisEventDisplayProps {
  activeEvent: EventCard | undefined;
  playSound?: (soundKey: string) => void;
}

const getEventIcon = (id: EventCardId) => {
  switch (id) {
    case 'state_of_emergency': return <AlertCircle className="w-5 h-5 text-red-400" />;
    case 'blackout': return <EyeOff className="w-5 h-5 text-gray-400" />;
    case 'snap_election': return <RotateCw className="w-5 h-5 text-purple-400" />;
    case 'iron_mandate': return <Zap className="w-5 h-5 text-yellow-400" />;
    case 'open_session': return <Scale className="w-5 h-5 text-blue-400" />;
    case 'censure_motion': return <UserMinus className="w-5 h-5 text-white" />;
    case 'veiled_proceedings': return <Shield className="w-5 h-5 text-emerald-400" />;
    case 'dead_mans_gambit': return <HelpCircle className="w-5 h-5 text-cyan-400" />;
    case 'double_or_nothing': return <Zap className="w-5 h-5 text-orange-400" />;
    default: return <AlertCircle className="w-5 h-5 text-primary" />;
  }
};

const getEventColor = (id: EventCardId) => {
  switch (id) {
    case 'state_of_emergency': return 'border-red-500/80 bg-red-900/30 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse-slow';
    case 'blackout': return 'border-zinc-700/50 bg-black/50 text-zinc-100';
    case 'snap_election': return 'border-purple-500/50 bg-purple-900/20 text-purple-100';
    case 'iron_mandate': return 'border-yellow-500/60 bg-yellow-900/20 text-yellow-100 overflow-hidden animate-shine';
    case 'open_session': return 'border-blue-500/50 bg-blue-900/20 text-blue-100';
    case 'censure_motion': return 'border-zinc-500/50 bg-zinc-800/40 text-zinc-100';
    case 'veiled_proceedings': return 'border-emerald-500/50 bg-emerald-900/20 text-emerald-100';
    case 'dead_mans_gambit': return 'border-cyan-500/50 bg-cyan-900/20 text-cyan-100';
    case 'double_or_nothing': return 'border-orange-500/50 bg-orange-900/20 text-orange-100';
    default: return 'border-subtle bg-elevated text-primary';
  }
};

export const CrisisEventDisplay: React.FC<CrisisEventDisplayProps> = ({ activeEvent }) => {
  return (
    <AnimatePresence mode="wait">
      {activeEvent && (
        <motion.div
          key={activeEvent.id}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className={cn(
            "fixed top-[15vh] left-[2vw] z-50 p-4 rounded-2xl border w-64 shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing",
            getEventColor(activeEvent.id)
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-xl bg-black/30 border border-white/10 shrink-0">
              {getEventIcon(activeEvent.id)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-widest text-white/40 mb-0.5">
                ACTIVE CRISIS
              </div>
              <h3 className="text-sm font-serif italic mb-1 leading-tight">
                {activeEvent.name}
              </h3>
              <p className="text-[11px] leading-relaxed opacity-90 font-sans">
                {activeEvent.description}
              </p>
            </div>
          </div>
          
          <div className="absolute top-2 right-2 flex gap-1">
             <div className="w-1 h-1 rounded-full bg-white/20" />
             <div className="w-1 h-1 rounded-full bg-white/20" />
             <div className="w-1 h-1 rounded-full bg-white/20" />
          </div>
          
          {/* Subtle scanning lines or effect */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none -z-10">
            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-30" />
            
            {activeEvent.id === 'blackout' && (
              <div className="absolute inset-0 bg-blackout-static opacity-60 mix-blend-screen" />
            )}

            <motion.div 
               animate={{ y: ["0%", "200%"] }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               className="h-1 w-full bg-white/10 absolute -top-1"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
