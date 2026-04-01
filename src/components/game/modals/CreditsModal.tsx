import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Globe, Award, Code, Palette, Heart, Lock } from 'lucide-react';
import { getProxiedUrl } from '../../../utils/utils';
import { CLIENT_VERSION } from '../../../sharedConstants';

interface CreditsModalProps {
  onClose: () => void;
  playSound: (soundKey: string) => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose, playSound }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          playSound('modal_close');
          onClose();
        }}
        className="absolute inset-0 bg-backdrop backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-surface border border-subtle rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-subtle flex items-center justify-between bg-elevated/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-900/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-thematic text-primary tracking-wide uppercase">
                Credits & Legal
              </h2>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest">
                Version {CLIENT_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('modal_close');
              onClose();
            }}
            className="p-2 hover:bg-card rounded-xl transition-colors text-ghost hover:text-primary"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-8">
          {/* Studio Info */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-elevated rounded-2xl p-2 border border-subtle">
              <img
                src="https://storage.googleapis.com/secretchancellor/HILogo.png"
                alt="Horsemen Interactive"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="text-2xl font-serif italic text-primary">Horsemen Interactive</h3>
              <p className="text-sm text-muted max-w-md mx-auto mt-2">
                Drafting the future of social deduction. Based in the digital assembly.
              </p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <a
                  href="https://horsemen-interactive.web.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:text-red-400 text-xs font-mono uppercase tracking-widest flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Development */}
            <div className="bg-elevated/30 border border-subtle rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Code className="w-4 h-4 text-blue-400" />
                <h4 className="font-mono text-xs uppercase tracking-widest font-bold">
                  Development
                </h4>
              </div>
              <ul className="space-y-2 text-sm text-muted font-serif italic">
                <li>Core Engine: Antigravity</li>
                <li>Frontend: React & Framer Motion</li>
                <li>Backend: Node.js & Socket.io</li>
                <li>Architecture: Assembly Systems</li>
              </ul>
            </div>

            {/* Design */}
            <div className="bg-elevated/30 border border-subtle rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Palette className="w-4 h-4 text-purple-400" />
                <h4 className="font-mono text-xs uppercase tracking-widest font-bold">
                  Art & Design
                </h4>
              </div>
              <ul className="space-y-2 text-sm text-muted font-serif italic">
                <li>UI Design: Horsemen Interactive</li>
                <li>Illustrations: AI Synthesis</li>
                <li>Sound Design: Assembly Audio</li>
              </ul>
            </div>
          </div>

          {/* Licensing */}
          <div className="space-y-4 border-t border-subtle pt-8">
            <h4 className="font-mono text-xs uppercase tracking-widest font-bold text-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" /> Legal Information
            </h4>
            <div className="text-xs text-muted font-mono leading-relaxed space-y-4">
              <p>
                © 2026 Horsemen Interactive. All rights reserved. The Assembly, the Horsemen
                Interactive logo, and all associated artistic assets are trademarks of Horsemen
                Interactive.
              </p>
              <p>
                Unauthorized duplication, modification, or distribution is prohibited. This software
                is provided "as is" without warranty of any kind, express or implied.
              </p>
              <div className="bg-card p-4 rounded-xl border border-subtle">
                <p className="text-[10px] text-faint uppercase font-bold mb-2 tracking-widest">
                  Open Source Disclosure
                </p>
                <p className="text-[10px]">
                  This project utilizes various open-source libraries including React, TailwindCSS,
                  Lucide, and Framer Motion. Full list of licenses available upon request.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-elevated/50 border-t border-subtle text-center">
          <p className="text-[10px] font-mono text-faint flex items-center justify-center gap-1">
            Made with <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500" /> by Horsemen
            Interactive
          </p>
        </div>
      </motion.div>
    </div>
  );
};


