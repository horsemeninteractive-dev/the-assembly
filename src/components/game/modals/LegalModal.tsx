import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Lock, Heart } from 'lucide-react';
import { CLIENT_VERSION } from '../../../sharedConstants';

interface LegalModalProps {
  onClose: () => void;
  playSound: (soundKey: string) => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ onClose, playSound }) => {
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
        className="relative w-full max-w-xl bg-surface-glass border border-subtle rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-subtle flex items-center justify-between bg-surface-glass/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-900/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-thematic text-primary tracking-wide uppercase">
                Legal Information
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
        <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-8">
          <div className="space-y-4 pt-2">
            <h4 className="font-mono text-xs uppercase tracking-widest font-bold text-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" /> Intellectual Property
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
              <div className="bg-surface-glass/60 p-4 rounded-xl border border-subtle backdrop-blur-sm">
                <p className="text-[10px] text-faint uppercase font-bold mb-3 tracking-widest flex items-center gap-1.5">
                  <Heart className="w-3 h-3 text-red-500" /> Open Source Acknowledgements
                </p>
                <p className="text-[10px] mb-3">
                  This game is made possible by the incredible work of the open source community. We gratefully acknowledge the use of the following core technologies:
                </p>
                <ul className="text-[10px] grid grid-cols-2 gap-1.5 text-primary/80">
                  <li>• React</li>
                  <li>• Socket.IO</li>
                  <li>• Motion</li>
                  <li>• Tailwind CSS</li>
                  <li>• Lucide</li>
                  <li>• Supabase</li>
                  <li>• Stripe</li>
                  <li>• Zod</li>
                </ul>
                <p className="text-[9px] text-faint mt-3 border-t border-subtle/50 pt-2">
                  All respective trademarks and copyrights belong to their original creators. Detailed license information (MIT, ISC, Apache 2.0, etc.) is retained in the source components.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-glass/60 border-t border-subtle text-center backdrop-blur-md">
          <p className="text-[10px] font-mono text-faint flex items-center justify-center gap-1">
            © 2026 Horsemen Interactive
          </p>
        </div>
      </motion.div>
    </div>
  );
};
