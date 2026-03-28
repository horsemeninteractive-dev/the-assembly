import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Loader2, CreditCard, ChevronRight, ShoppingBag } from 'lucide-react';
import { cn, apiUrl } from '../lib/utils';
import { CP_PACKAGES } from '../sharedConstants';

interface PurchaseCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  playSound: (soundKey: string) => void;
}



export const PurchaseCPModal: React.FC<PurchaseCPModalProps> = ({
  isOpen,
  onClose,
  token,
  playSound,
}) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    setIsLoading(packageId);
    setError(null);
    playSound('click');

    try {
      const response = await fetch(apiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate purchase');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('[Purchase] Error:', err);
      setError(err.message);
      setIsLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-backdrop-heavy backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-2xl bg-surface border border-subtle rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 bg-elevated border-b border-subtle flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-900/20 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Zap className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-xl font-thematic text-primary tracking-wide uppercase">
                    Acquire Cabinet Points
                  </h2>
                  <p className="text-xs text-muted font-mono tracking-widest uppercase mt-0.5">
                    Secure Transaction via Stripe
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 text-ghost hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 text-xs font-mono text-center">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CP_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={!!isLoading}
                    className={cn(
                      'relative group p-6 rounded-3xl border text-left transition-all duration-300 overflow-hidden',
                      isLoading === pkg.id
                        ? 'border-purple-500 bg-purple-900/10'
                        : 'border-subtle bg-card hover:border-purple-500/50 hover:bg-elevated',
                      pkg.popular && 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.05)]'
                    )}
                  >
                    {pkg.popular && (
                      <div className="absolute top-0 right-0 bg-purple-500 text-black text-[9px] font-bold py-1 px-4 rounded-bl-xl uppercase tracking-tighter">
                        Most Popular
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center border border-subtle group-hover:border-purple-500/30 transition-colors">
                        <Zap
                          className={cn(
                            'w-5 h-5',
                            pkg.popular ? 'text-purple-400' : 'text-purple-500'
                          )}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-2xl font-thematic text-primary tracking-wide leading-none">
                          {pkg.cp.toLocaleString()} CP
                        </span>
                        <span className="text-[10px] font-mono text-muted uppercase tracking-widest mt-1">
                          {pkg.name}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-ghost font-sans mb-6 line-clamp-2 h-8 leading-relaxed">
                      {pkg.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-bold text-primary">{pkg.displayPrice}</span>
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                          isLoading === pkg.id
                            ? 'bg-purple-500 text-black'
                            : 'bg-surface border border-subtle text-muted group-hover:bg-purple-900/20 group-hover:border-purple-500/30 group-hover:text-purple-400'
                        )}
                      >
                        {isLoading === pkg.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                    </div>

                    {/* Decorative elements */}
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
                  </button>
                ))}
              </div>

              {/* Secure Payment Notice */}
              <div className="mt-8 p-6 bg-elevated/50 border border-subtle rounded-3xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-full bg-surface border border-subtle flex items-center justify-center text-muted">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-mono text-primary uppercase tracking-widest mb-1">
                    Encrypted Payment
                  </p>
                  <p className="text-[10px] text-faint font-sans leading-relaxed">
                    Your payment information is processed securely by Stripe. We do not store your
                    credit card details.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 grayscale opacity-50 contrast-125">
                  <span className="text-[10px] font-bold tracking-tighter text-white bg-[#635BFF] px-2 py-1 rounded">
                    stripe
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-elevated/30 text-center border-t border-subtle">
              <button
                onClick={onClose}
                className="text-xs font-mono text-ghost hover:text-muted uppercase tracking-widest"
              >
                Return to Lobby
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
