import React from 'react';
import { motion } from 'motion/react';
import { getProxiedUrl } from '../../utils/utils';

export function EnterSplash({ user, onEnter }: { user: any, onEnter: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 lg:p-16 shadow-[0_0_60px_rgba(0,0,0,0.8)] text-center relative overflow-hidden"
    >
      {/* Background glow layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-red-900/10 pointer-events-none mix-blend-overlay" />
      
      {/* Logo Reveal */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-24 h-24 lg:w-32 lg:h-32 bg-black/60 rounded-3xl flex items-center justify-center border border-white/10 mx-auto mb-8 shadow-[0_0_30px_rgba(255,255,255,0.05)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
        <img src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')} className="w-full h-full object-contain p-4" alt="Logo" />
      </motion.div>

      {/* Main Welcome */}
      <motion.h2 
        initial={{ opacity: 0, letterSpacing: '0.4em' }}
        animate={{ opacity: 1, letterSpacing: '0.1em' }}
        transition={{ duration: 1.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-3xl lg:text-5xl font-thematic text-primary uppercase mb-6 drop-shadow-md"
      >
        Welcome, <span className="text-white/70">{user.username}</span>
      </motion.h2>

      {/* Thematic Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.3 }}
      >
        <div className="w-12 h-px bg-white/20 mx-auto mb-6" />
        <p className="text-tertiary text-sm lg:text-base font-serif italic mb-10 px-4 lg:px-12 leading-relaxed tracking-wide">
          "The old world ended with The Crisis.<br/>
          Now, only The Assembly stands...<br/><br/>
          <span className="text-white/60">Will you defend the Civil Charter, or will you build the new State?</span>"
        </p>
      </motion.div>

      {/* Interactive Button */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 2.0, ease: 'easeOut' }}
      >
        <button 
          onClick={onEnter} 
          className="relative w-full lg:w-3/4 mx-auto overflow-hidden bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-primary font-thematic text-xl lg:text-2xl py-5 rounded-2xl uppercase tracking-[0.2em] transition-all duration-500 shadow-xl hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] animate-shine"
        >
          Enter Assembly
        </button>
      </motion.div>
    </motion.div>
  );
}


