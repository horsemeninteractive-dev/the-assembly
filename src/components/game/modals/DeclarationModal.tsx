import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../utils/utils';
import { useTranslation, Trans } from '../../../contexts/I18nContext';

interface DeclarationModalProps {
  show: boolean;
  declarationType: 'President' | 'Chancellor' | 'Peek' | null;
  declCiv: number;
  declSta: number;
  declDrawCiv: number;
  declDrawSta: number;
  setDeclCiv: (n: number) => void;
  setDeclSta: (n: number) => void;
  setDeclDrawCiv: (n: number) => void;
  setDeclDrawSta: (n: number) => void;
  onSubmit: (refused?: boolean) => void;
  playSound: (key: string) => void;
  needsTotalDraw?: number;
}

export const DeclarationModal = ({
  show,
  declarationType,
  declCiv,
  declSta,
  declDrawCiv,
  declDrawSta,
  setDeclCiv,
  setDeclSta,
  setDeclDrawCiv,
  setDeclDrawSta,
  onSubmit,
  playSound,
  needsTotalDraw = 3,
}: DeclarationModalProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {show && declarationType && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-backdrop-heavy backdrop-blur-md flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-sm w-full bg-surface-glass border border-default rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6 backdrop-blur-2xl"
          >
            <div className="text-center space-y-2">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted font-mono">
                {t('game.modals.declaration.title')}
              </h3>
              <p className="text-xl font-thematic text-primary tracking-wide uppercase">
                {t('game.modals.declaration.subtitle')}
              </p>
              <p className="text-[10px] text-ghost italic">
                {t('game.modals.declaration.hint')}
              </p>
            </div>

            <div className="space-y-5">
              {/* President only: what they drew (3 cards) */}
              {declarationType === 'President' && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted font-mono ml-1">
                    <Trans
                      i18nKey="game.modals.declaration.drew_label"
                      components={{ 1: <span className="normal-case text-ghost" /> }}
                    />
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onMouseEnter={() => playSound('hover')}
                        onClick={() => {
                          setDeclDrawCiv(n);
                          setDeclDrawSta(3 - n);
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl border transition-all font-mono text-sm',
                          declDrawCiv === n
                            ? 'bg-blue-900/40 border-blue-500 text-blue-400'
                            : 'bg-surface-glass/40 border-subtle text-ghost backdrop-blur-sm'
                        )}
                      >
                        {n}C
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-center text-faint font-mono">
                    <Trans
                      i18nKey="game.modals.declaration.result_drew"
                      values={{ civ: declDrawCiv, sta: declDrawSta }}
                      components={{
                        1: <span className="text-blue-400" />,
                        3: <span className="text-red-500" />
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Peek (executive action) — 3 cards */}
              {declarationType === 'Peek' && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted font-mono ml-1">
                    <Trans
                      i18nKey="game.modals.declaration.peek_label"
                      components={{ 1: <span className="normal-case text-ghost" /> }}
                    />
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onMouseEnter={() => playSound('hover')}
                        onClick={() => {
                          setDeclCiv(n);
                          setDeclSta(3 - n);
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl border transition-all font-mono text-sm',
                          declCiv === n
                            ? 'bg-blue-900/40 border-blue-500 text-blue-400'
                            : 'bg-surface-glass/40 border-subtle text-ghost backdrop-blur-sm'
                        )}
                      >
                        {n}C
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-center text-faint font-mono">
                    <Trans
                      i18nKey="game.modals.declaration.result_peek"
                      values={{ civ: declCiv, sta: declSta }}
                      components={{
                        1: <span className="text-blue-400" />,
                        3: <span className="text-red-500" />
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Passed (president) or Received (chancellor) — 2 cards */}
              {declarationType !== 'Peek' && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted font-mono ml-1">
                    {declarationType === 'President' ? (
                      <Trans
                        i18nKey="game.modals.declaration.passed_label"
                        components={{ 1: <span className="normal-case text-ghost" /> }}
                      />
                    ) : (
                      <Trans
                        i18nKey="game.modals.declaration.received_label"
                        components={{ 1: <span className="normal-case text-ghost" /> }}
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((n) => (
                      <button
                        key={n}
                        onMouseEnter={() => playSound('hover')}
                        onClick={() => {
                          setDeclCiv(n);
                          setDeclSta(2 - n);
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl border transition-all font-mono text-sm',
                          declCiv === n
                            ? 'bg-blue-900/40 border-blue-500 text-blue-400'
                            : 'bg-surface-glass/40 border-subtle text-ghost backdrop-blur-sm'
                        )}
                      >
                        {n}C
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-center text-faint font-mono">
                    {declarationType === 'President' ? (
                      <Trans
                        i18nKey="game.modals.declaration.result_passed"
                        values={{ civ: declCiv, sta: declSta }}
                        components={{
                          1: <span className="text-blue-400" />,
                          3: <span className="text-red-500" />
                        }}
                      />
                    ) : (
                      <Trans
                        i18nKey="game.modals.declaration.result_received"
                        values={{ civ: declCiv, sta: declSta }}
                        components={{
                          1: <span className="text-blue-400" />,
                          3: <span className="text-red-500" />
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onMouseEnter={() => playSound('hover')}
                onClick={() => onSubmit(false)}
                disabled={
                  (declarationType !== 'Peek' && declCiv + declSta !== 2) || 
                  (declarationType === 'Peek' && declCiv + declSta !== 3) ||
                  (declarationType === 'President' && declDrawCiv + declDrawSta !== needsTotalDraw)
                }
                className="w-full py-4 btn-primary rounded-xl hover:bg-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-all font-thematic text-xl uppercase tracking-wide"
              >
                {t('game.modals.declaration.submit')}
              </button>

              {declarationType === 'Peek' && (
                <div className="space-y-2 pt-2">
                  <button
                    onMouseEnter={() => playSound('hover')}
                    onClick={() => onSubmit(true)}
                    className="w-full py-3 border border-red-500/30 bg-red-950/10 hover:bg-red-950/20 text-red-400/80 rounded-xl transition-all font-mono text-[10px] uppercase tracking-widest"
                  >
                    {t('game.modals.declaration.refuse_label')}
                  </button>
                  <p className="text-[9px] text-center text-red-500/40 italic">
                    {t('game.modals.declaration.refuse_hint')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


