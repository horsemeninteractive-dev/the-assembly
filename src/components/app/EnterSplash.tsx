import React from 'react';
import { motion } from 'motion/react';
import { getProxiedUrl } from '../../utils/utils';

export function EnterSplash({ user, onEnter }: { user: any, onEnter: any }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-surface border border-subtle rounded-3xl p-8 shadow-2xl text-center">
      <div className="w-20 h-20 bg-elevated rounded-2xl flex items-center justify-center border border-white/40 mx-auto mb-6 overflow-hidden">
        <img src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')} className="w-full h-full object-contain p-2" alt="Logo" />
      </div>
      <h2 className="text-3xl font-thematic text-primary uppercase mb-2">Welcome, {user.username}</h2>
      <p className="text-tertiary text-xs font-serif italic mb-8 px-4 opacity-70">"The old world ended with The Crisis. Now, only The Assembly stands... Will you defend the Civil Charter, or will you build the new State?"</p>
      <button onClick={onEnter} className="w-full btn-primary font-thematic text-2xl py-4 rounded-xl uppercase tracking-widest shadow-xl">Enter Assembly</button>
    </motion.div>
  );
}


