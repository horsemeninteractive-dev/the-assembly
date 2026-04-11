import React from 'react';
import { motion } from 'motion/react';
import { getProxiedUrl } from '../../utils/utils';

export function EnterSplash({ user, onEnter }: { user: any, onEnter: any }) {
  return (
    <div className="flex-1 w-full h-[100dvh] fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
      {/* Hero background — same image as landing page */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#07070a]">
        <img 
          src="/hero.png" 
          alt="" 
          aria-hidden="true"
          className="w-full h-full object-cover" 
        />
        {/* Overlay: dark vignette + blue-red split, matching landing page */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/25 via-transparent to-red-950/25" />
      </div>

      {/* Main Content Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-xl bg-black/55 backdrop-blur-xl border border-white/10 rounded-3xl p-10 lg:p-14 shadow-2xl text-center"
      >
        {/* Decorative Inner Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-red-500/5 pointer-events-none rounded-[3rem]" />
        
        {/* Logo and Brand Identity */}
        <div className="mb-10 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-28 h-28 lg:w-36 lg:h-36 bg-black/40 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)] relative overflow-hidden mb-6"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            <img 
              src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')} 
              className="w-full h-full object-contain p-5 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
              alt="Logo" 
            />
          </motion.div>

          {/* BRAND NAME UNDER LOGO */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="space-y-1"
          >
            <h1 className="text-3xl lg:text-4xl font-thematic text-white tracking-[0.25em] uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              The Assembly
            </h1>
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-red-500/50 to-transparent mx-auto" />
          </motion.div>
        </div>

        {/* User Welcome */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mb-8"
        >
          <p className="text-muted font-mono text-[10px] uppercase tracking-[0.4em] mb-2">Authenticated As</p>
          <h2 className="text-2xl lg:text-3xl font-serif italic text-primary">
            {user.username}
          </h2>
        </motion.div>

        {/* Narrative Divider */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "6rem" }}
          transition={{ duration: 1, delay: 1.1 }}
          className="h-px bg-white/10 mx-auto mb-8"
        />

        {/* Thematic Quote */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.3 }}
          className="text-tertiary text-xs lg:text-sm font-serif italic mb-12 px-2 lg:px-6 leading-relaxed tracking-wider opacity-80"
        >
          "The old world ended with The Crisis. Now, only The Assembly stands. Will you defend the Civil Charter, or build the new State?"
        </motion.p>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.7, ease: 'easeOut' }}
        >
          <button 
            onClick={onEnter} 
            className="group relative w-full lg:w-4/5 mx-auto overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-primary font-thematic text-lg lg:text-xl py-5 rounded-[1.5rem] uppercase tracking-[0.3em] transition-all duration-500 shadow-2xl hover:shadow-[0_0_50px_rgba(255,255,255,0.1)] animate-shine"
          >
            <span className="relative z-10 transition-transform duration-500 group-hover:scale-110 inline-block">
              Initiate Session
            </span>
          </button>
        </motion.div>
      </motion.div>
      
      {/* Absolute Film Grain for texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-5" />
    </div>
  );
}
