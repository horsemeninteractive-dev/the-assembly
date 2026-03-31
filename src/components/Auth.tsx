import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { User } from '../types';
import { getProxiedUrl } from '../lib/utils';
import { useAuthForm } from './auth/useAuthForm';
import { AuthLogin } from './auth/AuthLogin';
import { AuthRegister } from './auth/AuthRegister';
import { AuthPasswordReset } from './auth/AuthPasswordReset';

interface AuthProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const form = useAuthForm({ onAuthSuccess });
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
    <div className="flex-1 w-full flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-subtle rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center border border-white/40 mb-4 overflow-hidden">
            <img
              src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
              alt="Secret Chancellor Logo"
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-thematic text-primary tracking-wide uppercase">
            The Assembly
          </h1>
          <p className="text-muted text-sm mt-1">
            {view !== 'auth' ? 'Account Recovery' : isLogin ? 'Welcome back, Delegate' : 'Register for the Assembly'}
          </p>
        </div>

        {message && view === 'auth' && (
          <div className="mb-4 text-green-500 text-xs text-center font-mono bg-green-900/10 py-2 rounded-lg border border-green-900/20">
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
