import { Socket, Server } from 'socket.io';
import { logger } from '../logger';
import { getFriends } from '../supabaseService';
import { validateToken } from '../apiRoutes';
import { 
  getUserSocketId, 
  setUserSocketId, 
  removeUserSocketId, 
  getSocketId, 
  refreshUserStatus 
} from '../redis';
import { GameEngine } from '../gameEngine';

export function registerPresenceHandlers(
  socket: Socket, 
  io: Server, 
  engine: GameEngine, 
  userSockets: Map<string, string>
) {
  // Periodically refresh presence in Redis
  const staleInterval = setInterval(async () => {
    if (socket.data.userId) await refreshUserStatus(socket.data.userId);
  }, 60000);
  socket.data._presenceInterval = staleInterval;

  socket.on('userConnected', async ({ userId, token }: { userId: string; token: string }) => {
    const user = await validateToken(token);
    if (!user || user.id !== userId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'User ID mismatch or invalid token.' });
      socket.disconnect();
      return;
    }
    if (user?.isBanned) {
      socket.emit('error', { code: 'BANNED', message: 'Your account has been restricted.' });
      socket.disconnect();
      return;
    }
    socket.data.userId = userId;
    socket.data.isAdmin = user?.isAdmin || false;

    // FIX M-02: Write to both but local Map is secondary cache.
    // Divergence check: if Redis has a different ID, this new one wins but we note it.
    const existingSid = await getUserSocketId(userId);
    if (existingSid && existingSid !== socket.id) {
      logger.info({ userId, existingSid, newSid: socket.id }, 'Divergence detected on connect — resyncing socket ID');
    }
    userSockets.set(userId, socket.id);
    await setUserSocketId(userId, socket.id);

    const friends = await getFriends(userId);
    for (const friend of friends) {
      const friendSocketId = await getSocketId(friend.id, userSockets);
      if (friendSocketId) {
        // Find which room the friend is in (if any)
        let friendRoomId: string | undefined;
        for (const [rId, state] of engine.rooms.entries()) {
          if (state.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
            friendRoomId = rId;
            break;
          }
        }
        io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: true });
        socket.emit('userStatusChanged', {
          userId: friend.id,
          isOnline: true,
          roomId: friendRoomId,
        });
      }
    }
  });

  socket.on('disconnecting', async () => {
    if (socket.data.userId) {
      const userId = socket.data.userId;
      // Only remove if this specific socket is the one recorded.
      if (userSockets.get(userId) === socket.id) {
        userSockets.delete(userId);
        await removeUserSocketId(userId, socket.id);
        const friends = await getFriends(userId);
        for (const friend of friends) {
          const friendSocketId = await getSocketId(friend.id, userSockets);
          if (friendSocketId)
            io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: false });
        }
      }
    }
    if (socket.data._presenceInterval) clearInterval(socket.data._presenceInterval);

    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        await engine.handleLeave(socket, roomId);
      }
    }
  });
}

