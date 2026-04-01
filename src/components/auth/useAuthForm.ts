import { useState, useEffect, useCallback } from 'react';
import { User } from '../../../shared/types';
import { apiUrl, debugLog, debugError } from '../../utils/utils';
import { discordSdk } from '../../services/discord';
import { DISCORD_CLIENT_ID } from '../../constants';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export interface AuthFlowProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export function useAuthForm({ onAuthSuccess }: AuthFlowProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [view, setView] = useState<'auth' | 'forgot' | 'reset'>('auth');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const avatarChoices = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Casper',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Toby',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  ];

  const handleOAuthLogin = useCallback(async (provider: 'google' | 'discord') => {
    try {
      const isNative = Capacitor.isNativePlatform();
      const res = await fetch(
        apiUrl(`/api/auth/${provider}/url${isNative ? '?platform=android' : ''}`)
      );
      const data = await res.json();
      if (data.url) {
        if (isNative) {
          await Browser.open({ url: data.url });
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      debugError(`${provider} login error:`, err);
      setError(`Failed to initiate ${provider} login`);
    }
  }, []);

  const handleDiscordLogin = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const instanceId = discordSdk?.instanceId;
    try {
      if (instanceId) {
        debugLog('Environment: Discord Activity. Attempting SDK authorization...');
        const clientId = DISCORD_CLIENT_ID;

        if (!clientId) {
          throw new Error(
            'Configuration Error: Discord Client ID is missing from build. Please contact support.'
          );
        }

        const { code } = await discordSdk!.commands.authorize({
          client_id: clientId,
          response_type: 'code',
          state: '',
          scope: ['identify', 'guilds'],
        });
        debugLog('SDK authorize success. Exchanging code with server...');

        const response = await fetch(apiUrl('/api/auth/discord/callback'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, origin: window.location.origin }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.message || data.error || 'The game server rejected the login attempt. Please try again.'
          );
        }

        const data = await response.json();
        onAuthSuccess(data.user, data.token);
      } else {
        debugLog('Environment: Standard Web. Using OAuth flow.');
        const origin = window.location.origin;
        const isNative = Capacitor.isNativePlatform();
        const response = await fetch(
          apiUrl(
            `/api/auth/discord/url?origin=${encodeURIComponent(origin)}${isNative ? '&platform=android' : ''}`
          )
        );
        if (!response.ok) throw new Error('Failed to get auth URL from server');
        const { url } = await response.json();

        if (isNative) {
          await Browser.open({ url });
        } else if (discordSdk && window.self !== window.top) {
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
      debugError('Discord login process failed:', err);
      let msg = err.message || 'Unknown error';
      if (err.code === 4001) msg = 'Login cancelled. You must authorize the app to play.';
      setError(`Auth Failure: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthSuccess]);

  const handleSocialLogin = useCallback(async (provider: 'google' | 'discord') => {
    setError('');
    if (provider === 'discord') {
      await handleDiscordLogin();
      return;
    }
    try {
      if (discordSdk && (discordSdk.instanceId || window.self !== window.top)) {
        const origin = window.location.origin;
        const response = await fetch(
          apiUrl(`/api/auth/${provider}/url?origin=${encodeURIComponent(origin)}`)
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || data.error || `Failed to reach auth server for ${provider}`);
        }
        const { url } = await response.json();
        await discordSdk.commands.openExternalLink({ url });
      } else {
        await handleOAuthLogin(provider);
      }
    } catch (err: any) {
      debugError(`${provider} login process failed:`, err);
      setError(`${provider} Auth Error: ${err.message || 'Unknown error'}`);
    }
  }, [handleDiscordLogin, handleOAuthLogin]);

  return {
    isLogin, setIsLogin,
    view, setView,
    username, setUsername,
    email, setEmail,
    password, setPassword,
    resetToken, setResetToken,
    avatarUrl, setAvatarUrl,
    avatarChoices,
    isLoading, setIsLoading,
    error, setError,
    message, setMessage,
    handleSocialLogin,
  };
}


