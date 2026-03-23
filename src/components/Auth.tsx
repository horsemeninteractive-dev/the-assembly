import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User as UserIcon, Loader2, Chrome, MessageSquare } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { User } from '../types';
import { cn, getProxiedUrl } from '../lib/utils';
import { discordSdk } from '../lib/discord';
import { DISCORD_CLIENT_ID } from "../constants";

interface AuthProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const avatarChoices = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Casper',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Toby',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  ];

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.user && event.data.token) {
        onAuthSuccess(event.data.user as User, event.data.token as string);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthSuccess]);

  const handleDiscordLogin = async () => {
    setIsLoading(true);
    setError('');
    const instanceId = discordSdk?.instanceId;
    console.log("handleDiscordLogin triggered. SDK instanceId:", instanceId);
    
    try {
      if (instanceId) {
        console.log("Environment: Discord Activity. Attempting SDK authorization...");
        // Use hardcoded constant to avoid build-time env var issues
        const clientId = DISCORD_CLIENT_ID;
        console.log("DEBUG: DISCORD_CLIENT_ID:", clientId);
        
        if (!clientId) {
          throw new Error("Configuration Error: Discord Client ID is missing from build. Please contact support.");
        }
        
        const { code } = await discordSdk!.commands.authorize({
          client_id: DISCORD_CLIENT_ID,
          response_type: "code",
          state: "",
          // Removed prompt: "none" for manual clicks to allow first-time consent
          scope: ["identify", "guilds"],
        });
        console.log("SDK authorize success. Exchanging code with server...");

        const response = await fetch('/api/auth/discord/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, origin: window.location.origin }),
        });
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error("Server callback failed:", data);
          throw new Error(data.error || 'The game server rejected the login attempt. Please try again.');
        }
        
        const data = await response.json();
        console.log("Server authentication success!");
        onAuthSuccess(data.user, data.token);
      } else {
        console.log("Environment: Standard Web. Using OAuth flow.");
        const origin = window.location.origin;
        const isNative = Capacitor.isNativePlatform();
        const response = await fetch(`/api/auth/discord/url?origin=${encodeURIComponent(origin)}${isNative ? '&platform=android' : ''}`);
        if (!response.ok) throw new Error('Failed to get auth URL from server');
        const { url } = await response.json();
        
        if (isNative) {
          await Browser.open({ url });
        } else if (discordSdk && (window.self !== window.top)) {
          console.log("In iframe, using SDK openExternalLink:", url);
          await discordSdk.commands.openExternalLink({ url });
        } else {
          const isIframe = window.self !== window.top;
          if (isIframe) {
            window.open(url, 'oauth_popup', 'width=600,height=700');
          } else {
            window.location.href = url;
          }
        }
      }
    } catch (err: any) {
      console.error("Discord login process failed:", err);
      // Map common Discord SDK errors to user-friendly messages
      let msg = err.message || 'Unknown error';
      if (err.code === 4001) msg = "Login cancelled. You must authorize the app to play.";
      setError(`Auth Failure: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'discord') => {
    try {
      const isNative = Capacitor.isNativePlatform();
      const res = await fetch(`/api/auth/${provider}/url${isNative ? '?platform=android' : ''}`);
      const data = await res.json();
      if (data.url) {
        if (isNative) {
          await Browser.open({ url: data.url });
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error(`${provider} login error:`, err);
      setError(`Failed to initiate ${provider} login`);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'discord') => {
    console.log(`handleSocialLogin clicked for: ${provider}`);
    setError('');

    if (provider === 'discord') {
      await handleDiscordLogin();
      return;
    }

    try {
      // If we are in a Discord Activity, we MUST use openExternalLink for third-party OAuth
      // because Google blocks OAuth in embedded webviews/iframes.
      if (discordSdk && (discordSdk.instanceId || window.self !== window.top)) {
        const origin = window.location.origin;
        const response = await fetch(`/api/auth/${provider}/url?origin=${encodeURIComponent(origin)}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed to reach auth server for ${provider}`);
        }
        const { url } = await response.json();
        console.log(`In Discord, using commands.openExternalLink for ${provider}:`, url);
        await discordSdk.commands.openExternalLink({ url });
      } else {
        await handleOAuthLogin(provider);
      }
    } catch (err: any) {
      console.error(`${provider} login process failed:`, err);
      setError(`${provider} Auth Error: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, avatarUrl: isLogin ? undefined : avatarUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-subtle rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center border border-white/40 mb-4 overflow-hidden">
            <img src={getProxiedUrl("https://storage.googleapis.com/secretchancellor/SC.png")} alt="Secret Chancellor Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-3xl font-thematic text-primary tracking-wide uppercase">The Assembly</h1>
          <p className="text-muted text-sm mt-1">
            {isLogin ? 'Welcome back, Delegate' : 'Register for the Assembly'}
          </p>
        </div>

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
            <label className="text-[10px] font-mono text-ghost uppercase tracking-widest ml-1">Secure Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-subtle rounded-xl px-4 py-3 text-sm text-black focus:border-strong focus:outline-none transition-all placeholder:text-gray-400"
               placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest text-ghost font-mono ml-1">Choose Avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {avatarChoices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setAvatarUrl(choice)}
                    className={cn(
                      "w-full aspect-square rounded-lg border-2 overflow-hidden transition-all",
                      avatarUrl === choice ? "border-red-500 scale-110" : "border-subtle hover:border-default"
                    )}
                  >
                    <img src={getProxiedUrl(choice)} alt="Avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-subtle"></div>
            </div>
            <span className="relative px-4 bg-surface text-[10px] uppercase tracking-widest text-ghost font-mono">Or continue with</span>
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
            onClick={() => setIsLogin(!isLogin)}
            className="text-[11px] text-muted hover:text-white transition-colors font-mono uppercase tracking-widest"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
