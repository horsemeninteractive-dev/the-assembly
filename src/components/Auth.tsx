import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { User } from '../../shared/types';
import { getProxiedUrl } from '../utils/utils';
import { useAuthForm } from './auth/useAuthForm';
import { AuthLogin } from './auth/AuthLogin';
import { AuthRegister } from './auth/AuthRegister';
import { AuthPasswordReset } from './auth/AuthPasswordReset';
import { useTranslation } from '../contexts/I18nContext';

interface AuthProps {
  onAuthSuccess: (user: User, token: string) => void;
  defaultMode?: 'login' | 'register';
  onBackToLanding?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, defaultMode, onBackToLanding }) => {
  const { t } = useTranslation();
  const form = useAuthForm({ onAuthSuccess, defaultMode });
  const { isLogin, view, setView, setResetToken, message } = form;

  useEffect(() => {
    // Check for password reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && window.location.pathname.includes('reset-password')) {
      setResetToken(token);
      setView('reset');
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2,4}\.a\.run\.app$/;
      if (
        !CLOUD_RUN_PATTERN.test(origin) &&
        !origin.includes('localhost') &&
        origin !== window.location.origin &&
        origin !== 'https://theassembly.web.app'
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.user && event.data.token) {
        onAuthSuccess(event.data.user as User, event.data.token as string);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthSuccess, setResetToken, setView]);

  return (
    <div className="flex-1 w-full relative flex items-center justify-center p-4 font-sans overflow-hidden">
      {/* Hero background — same image as landing page */}
      <div className="absolute inset-0 z-0">
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

      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-6 left-6 z-50 flex items-center gap-2 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-mono tracking-widest uppercase font-bold hidden sm:inline">{t('auth.back')}</span>
        </button>
      )}

      {/* Form card — glassmorphism so it reads over the artwork */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-black/55 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black/60 rounded-2xl flex items-center justify-center border border-white/20 mb-4 overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            <img
              src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
              alt="The Assembly Logo"
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-thematic text-white tracking-wide uppercase">
            {t('common.title')}
          </h1>
          <p className="text-white/45 text-sm mt-1">
            {view !== 'auth' ? t('auth.recovery_title') : isLogin ? t('auth.welcome_back') : t('auth.register_assembly')}
          </p>
        </div>

        {message && view === 'auth' && (
          <div className="mb-4 text-green-400 text-xs text-center font-mono bg-green-900/15 py-2 rounded-lg border border-green-700/30">
            {message}
          </div>
        )}

        {view !== 'auth' ? (
          <AuthPasswordReset form={form} />
        ) : isLogin ? (
          <AuthLogin form={form} />
        ) : (
          <AuthRegister form={form} />
        )}
      </motion.div>
    </div>
  );
};


