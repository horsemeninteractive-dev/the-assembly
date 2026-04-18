import { useState, useEffect, useCallback } from 'react';
import { User, GameState, PrivateInfo, RoomPrivacy, StructuredError, GameMode, SystemConfig } from '../../shared/types';
import { socket } from '../socket';
import { apiUrl, debugLog, debugWarn, debugError } from '../utils/utils';
import * as aiSpeech from '../services/aiSpeech';

interface UseSocketManagerProps {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  playSound: (soundKey: string) => void;
}

export function useSocketManager({ user, token, setUser, playSound }: UseSocketManagerProps) {
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{ fromUsername: string; roomId: string } | null>(null);
  const [pendingFriendRequest, setPendingFriendRequest] = useState<{ fromUserId: string; fromUsername: string } | null>(null);
  const [pendingClanInvite, setPendingClanInvite] = useState<{ inviteId: string; clanId: string; clanName: string; clanTag: string; fromUsername: string } | null>(null);
  const [pendingSeasonReward, setPendingSeasonReward] = useState<{ tier: string; ipReward: number; cpReward: number; seasonPeriod: string } | null>(null);
  const [adminBroadcast, setAdminBroadcast] = useState<{ message: string; sender: string } | null>(null);
  const [serverRestarting, setServerRestarting] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    maintenanceMode: false,
    xpMultiplier: 1,
    ipMultiplier: 1,
    currentSeasonNumber: 0,
    currentSeasonPeriod: 'Season 0',
    currentSeasonEndsAt: '2026-05-02T00:00:00.000Z',
  });


  // Load system config from DB on mount (multipliers, maintenance mode, etc.)
  useEffect(() => {
    fetch(apiUrl('/api/config'))
      .then((res) => res.json())
      .then((cfg: SystemConfig) => { if (cfg) setSystemConfig(cfg); })
      .catch(() => {});
  }, []);

  const handleJoinRoom = useCallback(
    (
      roomId: string,
      maxPlayers?: number,
      actionTimer?: number,
      mode?: GameMode,
      isSpectator?: boolean,
      privacy?: RoomPrivacy,
      inviteCode?: string,
      avatarUrl?: string,
      isPractice?: boolean,
      aiDifficulty?: 'Casual' | 'Normal' | 'Elite'
    ) => {
      if (user) {
        socket.emit('joinRoom', {
          roomId,
          name: user.username,
          userId: user.id,
          activeFrame: user.activeFrame,
          activePolicyStyle: user.activePolicyStyle,
          activeVotingStyle: user.activeVotingStyle,
          maxPlayers,
          actionTimer,
          mode,
          isSpectator,
          privacy,
          inviteCode,
          avatarUrl: avatarUrl || user.avatarUrl,
          isPractice,
          aiDifficulty,
        });
      }
    },
    [user]
  );

  const handleLeaveRoom = useCallback(
    (onComplete?: () => void) => {
      socket.emit('leaveRoom');
      aiSpeech.stop();
      setJoined(false);
      setGameState(null);
      setPrivateInfo(null);

      if (token) {
        fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => res.json())
          .then((data) => {
            if (data.user) setUser(data.user);
            if (onComplete) onComplete();
          })
          .catch(() => {
            if (onComplete) onComplete();
          });
      } else if (onComplete) {
        onComplete();
      }
    },
    [token, setUser]
  );

  useEffect(() => {
    socket.on('gameStateUpdate', (state: import('../../shared/types').GameStateBroadcast) => {
      setGameState(state as unknown as GameState);
      setJoined(true);
    });
    socket.on('privateInfo', (info: PrivateInfo) => setPrivateInfo(info));
    socket.on('error', (err: string | StructuredError) => {
      const message = typeof err === 'string' ? err : err.message;
      setError(message);
      setTimeout(() => setError(null), 3000);
    });
    socket.on('userUpdate', (updatedUser: User) => setUser(updatedUser));
    socket.on('friendInvite', (data: { fromUsername: string; roomId: string }) => {
      setPendingInvite(data);
    });
    socket.on('queueDrained', () => {});
    socket.on('kicked', () => {
      handleLeaveRoom();
    });
    socket.on('friendRequestReceived', async (data: { fromUserId: string }) => {
      try {
        const res = await fetch(apiUrl(`/api/user/${data.fromUserId}`), {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const userData = await res.json();
          if (userData?.user) {
            setPendingFriendRequest({
              fromUserId: data.fromUserId,
              fromUsername: userData.user.username,
            });
            playSound('notification');
          }
        }
      } catch {}
    });
    socket.on('adminBroadcast', (data: { message: string; sender: string }) => {
      setAdminBroadcast(data);
      playSound('notification');
      setTimeout(() => setAdminBroadcast(null), 10000);
    });
    socket.on('clanInviteReceived', (data: { inviteId: string; clanId: string; clanName: string; clanTag: string; fromUsername: string }) => {
      setPendingClanInvite(data);
      playSound('notification');
    });
    socket.on('serverRestarting', (message: string) => {
      setServerRestarting(message);
      setTimeout(() => {
        window.location.reload();
      }, 5500);
    });
    socket.on('seasonRewardGranted', (data) => {
      setPendingSeasonReward(data);
      playSound('success');
    });
    socket.on('adminConfigUpdate', (config: SystemConfig) => {
      setSystemConfig(config);
    });
    socket.on('hostChanged', ({ newHostUserId }: { newHostUserId: string }) => {
      setGameState((prev) => (prev ? { ...prev, hostUserId: newHostUserId } : prev));
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('privateInfo');
      socket.off('error');
      socket.off('userUpdate');
      socket.off('friendInvite');
      socket.off('friendRequestReceived');
      socket.off('queueDrained');
      socket.off('kicked');
      socket.off('serverRestarting');
      socket.off('adminBroadcast');
      socket.off('hostChanged');
      socket.off('clanInviteReceived');
      socket.off('adminConfigUpdate');
      socket.off('seasonRewardGranted');
    };
  }, [handleLeaveRoom, playSound, setUser]);

  // Handle browser close / tab close / mobile app close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Direct emit instead of handleLeaveRoom to avoid fetch/state updates during cleanup
      // We use intentional: false so the server treats it as a potential reconnection case
      socket.emit('leaveRoom', { intentional: false });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Handle app backgrounding (switching tasks)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Player switched to a different app
        if (joined && gameState?.roomId) {
          socket.emit('leaveRoom', { intentional: false });
        }
      } else {
        // Player returned to the app
        if (joined && gameState?.roomId) {
          handleJoinRoom(gameState.roomId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [joined, gameState?.roomId, handleJoinRoom]);

  return {
    joined,
    setJoined,
    gameState,
    setGameState,
    privateInfo,
    setPrivateInfo,
    error,
    pendingInvite,
    setPendingInvite,
    pendingFriendRequest,
    setPendingFriendRequest,
    pendingClanInvite,
    setPendingClanInvite,
    pendingSeasonReward,
    setPendingSeasonReward,
    adminBroadcast,
    setAdminBroadcast,
    serverRestarting,
    systemConfig,
    handleJoinRoom,
    handleLeaveRoom,
  };
}


