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
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/30 via-transparent to-red-950/30" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Logo Icon */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-24 h-24 bg-black/60 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
          <img 
            src="https://storage.googleapis.com/secretchancellor/SC.png" 
            className="w-full h-full object-contain p-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" 
            alt="Logo" 
          />
        </motion.div>

        {/* Brand Text */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="space-y-3 mb-12"
          >
            <h1 className="text-3xl lg:text-4xl font-thematic text-white tracking-[0.35em] uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              The Assembly
            </h1>
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-red-500/50 to-transparent mx-auto" />
          </motion.div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center gap-6">
            <div className="flex gap-3">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{ 
                            opacity: [0.2, 1, 0.2],
                            scale: [0.8, 1.2, 0.8],
                            backgroundColor: i === 1 ? ["#ef4444", "#dc2626", "#ef4444"] : ["#ffffff", "#cbd5e1", "#ffffff"]
                        }}
                        transition={{ 
                            duration: 1.4, 
                            repeat: Infinity, 
                            delay: i * 0.2,
                            ease: "easeInOut"
                        }}
                        className="w-2 h-2 rounded-full border border-white/10"
                    />
                ))}
            </div>
            <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">
                {message}
            </p>
        </div>
      </div>
      
      {/* Absolute Film Grain */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-5" />
    </div>
  );
}
