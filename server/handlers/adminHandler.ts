import { Server, Socket } from 'socket.io';
import { GameEngine } from '../gameEngine.ts';
import { logger } from '../logger.ts';
import {
  adminUpdateUserSchema,
  kickPlayerSchema,
} from '../schemas.ts';
import { getUserById, updateSystemConfig, saveUser } from '../supabaseService.ts';
import { SystemConfig } from '../../src/types.ts';
import { getUserSocketId, getSocketId } from '../redis.ts';

/**
 * Handlers for administrative and host management actions like kicking players,
 * deleting rooms, and updating system configuration.
 */
export function registerAdminHandlers(
  socket: Socket,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>,
  configRef: { current: SystemConfig }
) {
  const getRoom = (): string | undefined => Array.from(socket.rooms).find((r) => r !== socket.id);

  socket.on('kickPlayer', (payload) => {
    const result = kickPlayerSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid kick data.');
    const targetPlayerId = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    // Only host can kick. hostUserId is stable (Supabase UUID).
    const host = state.players.find((p) => p.userId === state.hostUserId);
    if (!host || host.socketId !== socket.id) return;

    // targetPlayerId is the stable session UUID (p.id)
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (!target || target.id === host.id) return;

    state.players = state.players.filter((p) => p.id !== targetPlayerId);
    state.log.push(`${target.name} was removed by the host.`);

    // Emit to the volatile socket ID, not the stable session ID
    if (target.socketId) {
      io.to(target.socketId).emit('kicked');
    }
    engine.broadcastState(roomId);
  });

  socket.on('adminDeleteRoom', async (roomId: string) => {
    if (!socket.data.userId) return;
    const user = await getUserById(socket.data.userId);
    if (!user || !user.isAdmin) return;

    const state = engine.rooms.get(roomId);
    if (state) {
      state.log.push('This room has been terminated by an administrator.');
      engine.broadcastState(roomId);
      setTimeout(() => {
        io.to(roomId).emit('kicked');
        engine.deleteRoom(roomId);
        logger.info({ admin: user.username, roomId }, 'Admin deleted room');
        io.emit('adminBroadcast', {
          message: `Admin closed room: ${roomId}`,
          sender: 'System',
          timestamp: Date.now(),
        });
      }, 2000);
    } else {
      engine.deleteRoom(roomId);
      logger.info({ admin: user.username, roomId }, 'Admin deleted room (cleanup)');
    }
  });

  socket.on('adminBroadcast', async (message: string) => {
    if (!socket.data.userId) return;
    const user = await getUserById(socket.data.userId);
    if (!user || !user.isAdmin) return;
    io.emit('adminBroadcast', { message, sender: user.username, timestamp: Date.now() });
    logger.info({ admin: user.username, message }, 'Admin broadcast');
  });

  socket.on('adminUpdateUser', async (data: any) => {
    const result = adminUpdateUserSchema.safeParse(data);
    if (!result.success) {
      logger.warn(
        { errors: result.error.flatten(), adminId: socket.data.userId },
        'Invalid adminUpdateUser payload'
      );
      return socket.emit('error', 'Invalid update data provided.');
    }

    const { userId, updates } = result.data;
    if (!socket.data.userId) return;
    const admin = await getUserById(socket.data.userId);
    if (!admin || !admin.isAdmin) return;

    const targetUser = await getUserById(userId);
    if (!targetUser) return socket.emit('error', 'Target user not found.');

    if (updates.stats) targetUser.stats = { ...targetUser.stats, ...updates.stats };
    if (typeof updates.cabinetPoints === 'number') targetUser.cabinetPoints = updates.cabinetPoints;
    if (typeof updates.isBanned === 'boolean') targetUser.isBanned = updates.isBanned;
    if (typeof updates.isAdmin === 'boolean') targetUser.isAdmin = updates.isAdmin;
    if (updates.username) targetUser.username = updates.username;

    await saveUser(targetUser);
    const targetSocketId = await getSocketId(userId, userSockets);
    if (targetSocketId) {
      io.to(targetSocketId).emit('userUpdate', targetUser);
      if (targetUser.isBanned)
        io.to(targetSocketId).emit('kicked', 'Your account has been restricted.');
    }
  });

  socket.on('adminUpdateConfig', async (config: Partial<SystemConfig>) => {
    if (!socket.data.userId) return;
    const admin = await getUserById(socket.data.userId);
    if (!admin || !admin.isAdmin) return;
    
    configRef.current = await updateSystemConfig(config);
    io.emit('adminConfigUpdate', configRef.current);
  });

  socket.on('adminClearRedis', async () => {
    if (!socket.data.userId) return;
    const admin = await getUserById(socket.data.userId);
    if (!admin || !admin.isAdmin) return;
    await engine.clearAllRedisRooms();
    socket.emit('adminClearRedisSuccess', 'Successfully purged all Redis room state.');
  });
}
