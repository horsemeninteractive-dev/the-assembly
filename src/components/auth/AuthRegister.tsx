import React from 'react';
import { Loader2 } from 'lucide-react';
import { apiUrl, getProxiedUrl, cn } from '../../utils/utils';
import { useAuthContext } from '../../contexts/AuthContext';

export const AuthRegister: React.FC<any> = ({ form }) => {
  const { handleAuthSuccess } = useAuthContext();
  const {
    username, setUsername, email, setEmail,
    password, setPassword, avatarUrl, setAvatarUrl,
    avatarChoices, isLoading, setIsLoading,
    error, setError, setIsLogin
  } = form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, avatarUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Registration failed');

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
          <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
            placeholder="Agent Handle"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
            placeholder="agent@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono text-ghost uppercase tracking-widest ml-1">Secure Key</label>
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

        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">Choose Avatar</label>
          <div className="grid grid-cols-6 gap-2">
            {avatarChoices.map((choice: string) => (
              <button
                key={choice}
                type="button"
                onClick={() => setAvatarUrl(choice)}
                className={cn(
                  'w-full aspect-square rounded-lg border-2 overflow-hidden transition-all',
                  avatarUrl === choice ? 'border-red-500 scale-110' : 'border-subtle hover:border-default'
                )}
              >
                <img src={getProxiedUrl(choice)} alt="Avatar" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
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
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(true)}
          className="text-[11px] text-muted hover:text-white transition-colors font-mono uppercase tracking-widest"
        >
          Already have an account? Login
        </button>
      </div>
    </div>
  );
};


