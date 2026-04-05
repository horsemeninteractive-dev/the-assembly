import { Request, Response } from 'express';
import { RouteContext } from './types';
import { RoomInfo } from '../../shared/types';
import { requireAuth } from './shared';

export function registerRoomRoutes({ app, engine }: RouteContext): void {
  app.get('/api/rooms', async (_req: Request, res: Response) => {
    const roomList = (await Promise.all(
      Array.from(engine.rooms.entries())
        .filter(([, state]) => !state.isPractice)
        .map(([id, state]) => {
          const averageElo = state.averageElo;
          const host = state.players.find((p) => p.userId === state.hostUserId) || state.players[0];
          return {
            id,
            name: state.roomId,
            playerCount: state.players.length,
            spectatorCount: state.spectators.length,
            maxPlayers: state.maxPlayers,
            phase: state.phase,
            actionTimer: state.actionTimer,
            playerAvatars: state.players.map((p) => p.avatarUrl || '').filter(Boolean),
            mode: state.mode,
            averageElo,
            privacy: state.privacy ?? 'public',
            isLocked: state.isLocked ?? false,
            hostName: host?.name || 'Unknown',
            isPractice: !!state.isPractice,
          } as RoomInfo;
        })
    )).filter(Boolean);
    res.json(roomList);
  });

  app.get('/api/rejoin-info', requireAuth, (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) return res.json({ canRejoin: false });
    for (const state of engine.rooms.values()) {
      const player = state.players.find((p) => p.userId === userId && p.isDisconnected);
      if (player) {
        return res.json({
          canRejoin: true,
          roomId: state.roomId,
          roomName: state.roomId,
          mode: state.mode,
        });
      }
    }
    res.json({ canRejoin: false });
  });
}

