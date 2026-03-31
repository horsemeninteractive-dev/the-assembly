import React, { createContext, useContext } from 'react';
import { useSocketManager } from '../hooks/useSocketManager';
import { useAuthContext } from './AuthContext';
import { useAudioContext } from './AudioContext';
import { GameState, PrivateInfo, RoomPrivacy } from '../types';

interface GameContextType {
  joined: boolean;
  setJoined: React.Dispatch<React.SetStateAction<boolean>>;
  gameState: GameState | null;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
  privateInfo: PrivateInfo | null;
  setPrivateInfo: React.Dispatch<React.SetStateAction<PrivateInfo | null>>;
  error: string | null;
  pendingInvite: { fromUsername: string; roomId: string } | null;
  setPendingInvite: React.Dispatch<React.SetStateAction<{ fromUsername: string; roomId: string } | null>>;
  pendingFriendRequest: { fromUserId: string; fromUsername: string } | null;
  setPendingFriendRequest: React.Dispatch<React.SetStateAction<{ fromUserId: string; fromUsername: string } | null>>;
  adminBroadcast: { message: string; sender: string } | null;
  setAdminBroadcast: React.Dispatch<React.SetStateAction<{ message: string; sender: string } | null>>;
  serverRestarting: string | null;
  handleJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: 'Casual' | 'Ranked' | 'Classic',
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string
  ) => void;
  handleLeaveRoom: (onComplete?: () => void) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, setUser } = useAuthContext();
  const { playSound } = useAudioContext();
  const socketManager = useSocketManager({ user, token, setUser, playSound });

  return (
    <GameContext.Provider value={socketManager}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
