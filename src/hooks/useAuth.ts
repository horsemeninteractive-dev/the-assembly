import { useState, useEffect, useCallback } from 'react';
import { User } from '../../shared/types';
import { socket } from '../socket';
import { discordSdk, setupDiscordSdk } from '../services/discord';
import { DISCORD_CLIENT_ID } from '../constants';
import { apiUrl, debugLog, debugWarn, debugError } from '../utils/utils';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInteracted, setIsInteracted] = useState(false);
  const [isDiscord, setIsDiscord] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('frame_id') || params.has('instance_id');
  });
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  });
  const [showTutorial, setShowTutorial] = useState(false);

  const handleAuthSuccess = useCallback((userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    socket.emit('userConnected', { userId: userData.id, token: authToken });
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement
          .requestFullscreen()
          .then(() => setIsInteracted(true))
          .catch(() => setIsInteracted(false));
      }
    } catch {
      setIsInteracted(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    fetch(apiUrl('/api/logout'), { method: 'POST' }).catch(() => {});
    setIsInteracted(false);
  }, []);

  const handleEnterAssembly = useCallback(() => {
    setIsInteracted(true);
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* ignore */
    }
    const instanceId = discordSdk?.instanceId;
    if (instanceId && user) {
      socket.emit('joinRoom', {
        roomId: instanceId.slice(0, 8),
        name: user.username,
        userId: user.id,
        activeFrame: user.activeFrame,
        activePolicyStyle: user.activePolicyStyle,
        activeVotingStyle: user.activeVotingStyle,
        maxPlayers: 10,
        actionTimer: 60,
        mode: 'Casual',
        privacy: 'public',
      });
    }
  }, [user]);

  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false);
    if (token) {
      try {
        await fetch(apiUrl('/api/tutorial-complete'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const res = await fetch(apiUrl('/api/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.user) setUser(data.user);
      } catch {}
    }
  }, [token]);

  useEffect(() => {
    if (
      isInteracted &&
      user &&
      user.stats.gamesPlayed === 0 &&
      !user.claimedRewards.includes('tutorial-complete')
    ) {
      setShowTutorial(true);
    }
  }, [isInteracted, user?.id]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await setupDiscordSdk();
        const instanceId = discordSdk?.instanceId;

        let currentUser: User | null = null;
        let currentToken: string | null = null;

        if (instanceId && DISCORD_CLIENT_ID) {
          setIsDiscord(true);
          try {
            const { code } = await discordSdk!.commands.authorize({
              client_id: DISCORD_CLIENT_ID as string,
              response_type: 'code',
              state: '',
              prompt: 'none',
              scope: ['identify', 'guilds'],
            });
            const response = await fetch(apiUrl('/api/auth/discord/callback'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, origin: window.location.origin }),
            });
            if (response.ok) {
              const data = await response.json();
              currentUser = data.user;
              currentToken = data.token;
            }
          } catch (err) {
            debugWarn('Discord auto-login failed or was denied.');
          }
        }

        if (!currentUser) {
          try {
            const res = await fetch(apiUrl('/api/me'), { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              if (data.user) {
                currentUser = data.user;
                currentToken = data.token;
              }
            }
          } catch (err) {
            debugError('Session restore failed:', err);
          }
        }

        if (currentUser && currentToken) {
          setUser(currentUser);
          setToken(currentToken);
          socket.emit('userConnected', { userId: currentUser.id, token: currentToken });

          if (instanceId) {
            setIsInteracted(true);
            socket.emit('joinRoom', {
              roomId: instanceId.slice(0, 8),
              name: currentUser.username,
              userId: currentUser.id,
              activeFrame: currentUser.activeFrame,
              activePolicyStyle: currentUser.activePolicyStyle,
              activeVotingStyle: currentUser.activeVotingStyle,
              maxPlayers: 10,
              actionTimer: 60,
              mode: 'Casual',
              privacy: 'public',
            });
            try {
              discordSdk!.subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', (evt: any) => {
                if (evt?.layout_mode === 0) {
                  socket.emit('leaveRoom');
                  socket.disconnect();
                }
              });
            } catch {}
          }
        }
      } catch (err) {
        debugError('Init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Web OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlUser = params.get('user');
    const urlCode = params.get('code');

    const handleCodeExchange = async (code: string) => {
      try {
        const res = await fetch(apiUrl('/api/auth/exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          handleAuthSuccess(data.user, data.token);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        debugError('Code exchange failed', e);
      }
    };

    if (urlCode) {
      handleCodeExchange(urlCode);
    } else if (urlToken && urlUser) {
      try {
        const userData = JSON.parse(decodeURIComponent(urlUser));
        handleAuthSuccess(userData, urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        debugError('Web OAuth parse failed', e);
      }
    }
  }, [handleAuthSuccess]);

  // Capacitor OAuth
  useEffect(() => {
    let listenerHandle: any;
    CapApp.addListener('appUrlOpen', (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        const urlToken = url.searchParams.get('token');
        const urlUser = url.searchParams.get('user');
        const urlCode = url.searchParams.get('code');

        if (urlCode) {
          if (Capacitor.isNativePlatform()) Browser.close().catch(() => {});
          fetch(apiUrl('/api/auth/exchange'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: urlCode }),
            credentials: 'include',
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.user && data.token) handleAuthSuccess(data.user, data.token);
            })
            .catch((e) => debugError('Capacitor Code exchange failed', e));
        } else if (urlToken && urlUser) {
          if (Capacitor.isNativePlatform()) Browser.close().catch(() => {});
          const userData = JSON.parse(decodeURIComponent(urlUser));
          handleAuthSuccess(userData, urlToken);
        }
      } catch (e) {
        debugError('Capacitor OAuth parse failed', e);
      }
    }).then((h) => (listenerHandle = h));
    return () => listenerHandle?.remove();
  }, [handleAuthSuccess]);

  return {
    user,
    setUser,
    token,
    loading,
    isInteracted,
    setIsInteracted,
    isDiscord,
    isMobile,
    showTutorial,
    setShowTutorial,
    handleAuthSuccess,
    handleLogout,
    handleEnterAssembly,
    handleTutorialComplete,
  };
}


