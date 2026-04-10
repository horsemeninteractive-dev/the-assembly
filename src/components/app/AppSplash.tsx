import React from 'react';
import { motion } from 'motion/react';

export function AppSplash({ message = "Initializing Session" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden bg-[#07070a]">
      {/* Background Layer: Frosted Hero Art */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img 
          src="/hero.png" 
          alt="" 
          className="w-full h-full object-cover opacity-60 blur-xl scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/20 via-transparent to-red-950/20" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Logo Icon */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-24 h-24 bg-black/40 rounded-[20px] flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)] relative overflow-hidden mb-8"
        >
          <img 
            src="https://storage.googleapis.com/secretchancellor/SC.png" 
            className="w-full h-full object-contain p-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
            alt="Logo" 
          />
        </motion.div>

        {/* Brand Text */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="space-y-3 mb-10"
          >
            <h1 className="text-2xl lg:text-3xl font-thematic text-white tracking-[0.3em] uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              The Assembly
            </h1>
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-red-500/50 to-transparent mx-auto" />
          </motion.div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{ 
                            opacity: [0.3, 1, 0.3],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{ 
                            duration: 1, 
                            repeat: Infinity, 
                            delay: i * 0.2 
                        }}
                        className="w-1.5 h-1.5 bg-red-500 rounded-full"
                    />
                ))}
            </div>
            <p className="text-primary/60 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">
                {message}
            </p>
        </div>
      </div>
      
      {/* Absolute Film Grain */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-5" />
    </div>
  );
}
