import React from 'react';
import { motion } from 'motion/react';
import { Lock, Loader2 } from 'lucide-react';
import { apiUrl } from '../../lib/utils';

export const AuthPasswordReset: React.FC<any> = ({ form }) => {
  const {
    view, setView, email, setEmail,
    password, setPassword, resetToken,
    isLoading, setIsLoading, error, setError,
    message, setMessage, setIsLogin
  } = form;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, origin: window.location.origin }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reset link');

      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      setMessage(data.message);
      setTimeout(() => {
        setView('auth');
        setIsLogin(true);
        setPassword('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'forgot') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
        <div className="flex flex-col items-center mb-8 text-center">
          <Lock className="w-12 h-12 text-primary mb-4" />
          <h2 className="text-2xl font-thematic text-primary uppercase">Account Recovery</h2>
          <p className="text-muted text-sm mt-1">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
              placeholder="agent@example.com"
              required
            />
          </div>

          {error && <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-2 rounded-lg border border-red-900/20">{error}</div>}
          {message && <div className="text-green-500 text-xs text-center font-mono bg-green-900/10 py-2 rounded-lg border border-green-900/20">{message}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary font-thematic text-xl py-3 rounded-xl hover:bg-subtle transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setView('auth'); setError(''); setMessage(''); }}
            className="text-[11px] text-muted hover:text-white transition-colors font-mono uppercase tracking-widest"
          >
            Back to Login
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
      <div className="flex flex-col items-center mb-8 text-center">
        <Lock className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-2xl font-thematic text-primary uppercase">Set New Password</h2>
        <p className="text-muted text-sm mt-1">Enter your new secure key</p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-mono text-ghost uppercase tracking-widest ml-1">New Secure Key</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
            placeholder="••••••••"
            required
            minLength={8}
          />
        </div>

        {error && <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-2 rounded-lg border border-red-900/20">{error}</div>}
        {message && <div className="text-green-500 text-xs text-center font-mono bg-green-900/10 py-2 rounded-lg border border-green-900/20">{message}</div>}

        <button
          type="submit"
          disabled={isLoading || !!message}
          className="w-full btn-primary font-thematic text-xl py-3 rounded-xl hover:bg-subtle transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reset Password'}
        </button>
      </form>
    </motion.div>
  );
};
