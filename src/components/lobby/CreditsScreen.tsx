import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart } from 'lucide-react';
import { MUSIC_TRACKS } from '../../utils/audio';
import { getProxiedUrl } from '../../utils/utils';
import { getBackgroundTexture } from '../../utils/cosmetics';

interface CreditsScreenProps {
  user: any; // Using any for simplicity here to match the User type
  onClose: () => void;
  playSound: (soundKey: string) => void;
}

const CREDITS_DATA = [
  { section: "Founder & Lead Architect", names: ["Daniel Stone"] },
  { section: "Core Prototyping", names: ["Google AI Studio"] },
  { section: "Primary Development", names: ["Google Antigravity"] },
  { section: "Design & Technical Assistance", names: ["Gemini 3.1 Pro", "Gemini 3 Flash", "Claude Sonnet 4.6", "ChatGPT 5.4"] },
  { section: "Musical Composition", names: ["Suno v4.5"] },
  { section: "Art Production", names: ["Gemini", "Midjourney"] },
  { section: "Sound Engineering", names: ["Kenney's Sound Pack"] },
  { section: "Special Thanks", names: ["The Beta Testing Cohort", "All Early Supporters", "The Open Source Community"] },
];

export const CreditsScreen: React.FC<CreditsScreenProps> = ({ user, onClose, playSound }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Flatten the credits into a sequential timeline of names
  const sequence = useMemo(() => {
    const list: any[] = [{ type: 'intro' }];
    CREDITS_DATA.forEach((group) => {
      group.names.forEach((name) => {
        list.push({ type: 'credit', section: group.section, name });
      });
    });
    list.push({ type: 'finale' });
    return list;
  }, []);

  const totalSlides = sequence.length;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const runTimer = (idx: number) => {
      let duration = 6500; // Longer standard duration for name credits
      if (sequence[idx].type === 'intro') duration = 6000;
      if (sequence[idx].type === 'finale') duration = 15000;
      
      timeout = setTimeout(() => {
        const nextIdx = (idx + 1) % totalSlides;
        setCurrentIndex(nextIdx);
        runTimer(nextIdx);
      }, duration);
    };

    runTimer(0);

    return () => {
      clearTimeout(timeout);
    };
  }, [totalSlides, sequence]);

  const current = sequence[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#07070a] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background with Glassmorphism */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-black">
        <img 
          src="/hero.png" 
          alt="" 
          className="w-full h-full object-cover opacity-80 blur-xl scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-red-900/10" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
      </div>

      {/* Background Ambience */}
      <div className="absolute inset-0 z-[1] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-transparent to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(185,28,28,0.15)_0%,transparent_50%)] animate-pulse" />
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={() => {
          playSound('modal_close');
          onClose();
        }}
        className="absolute top-6 right-6 sm:top-8 sm:right-8 z-[210] p-3 sm:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group backdrop-blur-md"
      >
        <X className="w-6 h-6 sm:w-8 sm:h-8 text-white/50 group-hover:text-white" />
      </motion.button>

      <div className="relative z-[10] w-full h-full flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {current.type === 'intro' && (
             <motion.div
               key="intro"
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.2 }}
               transition={{ duration: 1.5 }}
               className="flex flex-col items-center space-y-6 sm:space-y-8 text-center px-6"
             >
               <img
                 src="https://storage.googleapis.com/secretchancellor/SC.png"
                 alt="The Assembly"
                 className="w-32 h-32 sm:w-48 h-48 mx-auto drop-shadow-[0_0_50px_rgba(185,28,28,0.4)]"
               />
               <div className="space-y-3 sm:space-y-4">
                 <h1 className="text-4xl sm:text-7xl font-thematic text-white tracking-[0.15em] sm:tracking-[0.3em] uppercase">
                   The Assembly
                 </h1>
                 <p className="text-lg sm:text-2xl font-mono text-red-500 uppercase tracking-[0.3em] sm:tracking-[0.5em]">
                   Credits
                 </p>
               </div>
             </motion.div>
          )}

          {current.type === 'credit' && (
            <div key="credit-container" className="flex flex-col items-center justify-center w-full space-y-12 sm:space-y-16 px-6">
              {/* Section Title: Only animates when the section changes */}
              <div className="h-10 sm:h-12 flex items-center justify-center overflow-visible">
                <AnimatePresence mode="wait">
                  <motion.h3
                    key={current.section}
                    initial={{ x: "-100vw", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100vw", opacity: 0 }}
                    transition={{ 
                      duration: 1, 
                      ease: [0.22, 1, 0.36, 1] 
                    }}
                    className="text-base sm:text-2xl font-mono text-red-600 uppercase tracking-[0.3em] sm:tracking-[0.7em] text-center"
                  >
                    {current.section}
                  </motion.h3>
                </AnimatePresence>
              </div>
 
              {/* Name: Animates on every step */}
              <div className="h-20 sm:h-24 flex items-center justify-center overflow-visible">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={current.name}
                    initial={{ x: "100vw", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "-100vw", opacity: 0 }}
                    transition={{ 
                      duration: 1, 
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    className="text-4xl sm:text-7xl lg:text-8xl font-serif italic text-white leading-tight text-center"
                  >
                    {current.name}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          )}

          {current.type === 'finale' && (
            <motion.div
              key="finale"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
              className="flex flex-col items-center space-y-8 sm:space-y-10 text-center px-6"
            >
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="w-48 h-48 sm:w-72 sm:h-72 mx-auto bg-white/5 rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 border border-white/10 backdrop-blur-2xl"
              >
                <img
                  src="https://storage.googleapis.com/secretchancellor/HILogo.png"
                  alt="Horsemen Interactive"
                  className="w-full h-full object-contain"
                />
              </motion.div>
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-3xl sm:text-5xl font-serif italic text-white tracking-tight">Horsemen Interactive</h2>
                <div className="flex items-center justify-center gap-6 sm:gap-10">
                  <span className="w-12 sm:w-20 h-px bg-white/20" />
                  <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 fill-red-600 animate-pulse" />
                  <span className="w-12 sm:w-20 h-px bg-white/20" />
                </div>
                <p className="text-xs sm:text-sm font-mono text-white/40 uppercase tracking-[0.3em] sm:tracking-[0.5em] font-medium px-4">
                  Redefining the future of play.
                </p>
                <div className="pt-2 sm:pt-4">
                   <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">Based in the United Kingdom</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Aesthetic Overlays */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none" />
      
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </motion.div>
  );
};
