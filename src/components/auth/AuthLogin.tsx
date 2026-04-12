import React from 'react';
import { Chrome, MessageSquare, Loader2 } from 'lucide-react';
import { apiUrl } from '../../utils/utils';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';

export const AuthLogin: React.FC<any> = ({ form }) => {
  const { t } = useTranslation();
  const { handleAuthSuccess } = useAuthContext();
  const {
    username, setUsername,
    password, setPassword,
    isLoading, setIsLoading,
    error, setError,
    handleSocialLogin, setView, setIsLogin
  } = form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Authentication failed');

      handleAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">{t('auth.form.username')}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
            placeholder={t('auth.form.username_placeholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono text-ghost uppercase tracking-widest ml-1">{t('auth.form.password')}</label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-[9px] text-muted hover:text-primary transition-colors uppercase font-mono"
            >
              {t('auth.form.forgot_password')}
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-2 rounded-lg border border-red-900/20">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary font-thematic text-xl py-3 rounded-xl hover:bg-subtle transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.form.sign_in')}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-subtle"></div>
          </div>
          <span className="relative px-4 bg-surface text-[10px] uppercase tracking-widest text-ghost font-mono">{t('auth.form.or_continue')}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSocialLogin('google')}
            className="flex items-center justify-center gap-2 py-2.5 bg-elevated border border-subtle rounded-xl text-xs text-secondary hover:text-white hover:border-default transition-all"
          >
            <Chrome className="w-4 h-4" />
            <span>Google</span>
          </button>
          <button
            onClick={() => handleSocialLogin('discord')}
            className="flex items-center justify-center gap-2 py-2.5 bg-elevated border border-subtle rounded-xl text-xs text-secondary hover:text-white hover:border-default transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discord</span>
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(false)}
          className="text-[11px] text-muted hover:text-white transition-colors font-mono uppercase tracking-widest"
        >
          {t('auth.form.register_prompt')}
        </button>
      </div>
    </div>
  );
};


