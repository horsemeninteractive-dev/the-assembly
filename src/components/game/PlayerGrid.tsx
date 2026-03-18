import React from 'react';
import { socket } from '../../socket';
import { GameState, Player } from '../../types';
import { cn } from '../../lib/utils';
import { PlayerCard } from './PlayerCard';

// ── Grid container ────────────────────────────────────────────────────────────

interface PlayerGridProps {
  gameState: GameState;
  me: Player | undefined;
  speakingPlayers: Record<string, boolean>;
  playSound: (key: string) => void;
  token: string;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  isVideoActive: boolean;
  isSpectator?: boolean;
  isHost?: boolean;
}

export const PlayerGrid = ({
  gameState, me, speakingPlayers, playSound, token,
  selectedPlayerId, setSelectedPlayerId,
  localStream, remoteStreams, isVideoActive, isSpectator = false, isHost = false,
}: PlayerGridProps) => {
  const isPresidentialCandidate = !!me?.isPresidentialCandidate;
  const isPresident             = !!me?.isPresident;
  const isManyPlayers           = gameState.players.length > 6;

  return (
    <div className="flex-1 p-[1vh] sm:p-[1.5vh] min-h-0 overflow-hidden">
      <div className={cn(
        'grid gap-[1vh] sm:gap-[1.5vh] h-full grid-cols-2',
        gameState.players.length <= 6 ? 'grid-rows-3' :
        gameState.players.length <= 8 ? 'grid-rows-4' : 'grid-rows-5',
        'sm:grid-cols-5 sm:grid-rows-2'
      )}>
        {gameState.players.map((p, index) => {
          if (!p) return null;
          const isMe   = p.id === socket.id;
          const stream = isMe ? (isVideoActive ? localStream : null) : remoteStreams[p.id];
          return (
            <PlayerCard
              key={p.id}
              p={p}
              index={index}
              gameState={gameState}
              isMe={isMe}
              isPresidentialCandidate={isPresidentialCandidate}
              isPresident={isPresident}
              isManyPlayers={isManyPlayers}
              isSpectator={isSpectator}
              isHost={isHost}
              stream={stream}
              isVideoActive={isVideoActive}
              speakingPlayers={speakingPlayers}
              playSound={playSound}
              setSelectedPlayerId={setSelectedPlayerId}
            />
          );
        })}
      </div>
    </div>
  );
};
