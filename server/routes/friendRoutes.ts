import { Request, Response } from 'express';
import { RouteContext } from './types';
import { requireAuth, sanitizeUser } from './shared';
import { UserInternal } from '../../shared/types';
import {
  getFriends,
  getPendingFriendRequests,
  searchUsers,
  isFriend,
  sendFriendRequest,
  acceptFriendRequest,
  getUserById,
  removeFriend,
} from '../supabaseService';
import { getUserSocketId, getSocketId } from '../redis';

export function registerFriendRoutes({ app, io, engine, userSockets }: RouteContext): void {
  app.get('/api/friends/status', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const friends = await getFriends(user.id);
      const statuses: Record<string, { isOnline: boolean; roomId?: string }> = {};
      for (const friend of friends) {
        const friendSocketId = await getSocketId(friend.id, userSockets);
        if (friendSocketId) {
          let roomId: string | undefined;
          for (const [rId, state] of engine.rooms.entries()) {
            if (state.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
              roomId = rId;
              break;
            }
          }
          statuses[friend.id] = { isOnline: true, roomId };
        } else {
          statuses[friend.id] = { isOnline: false };
        }
      }
      res.json({ statuses });
    } catch (_) {
      res.status(500).json({ error: 'Failed to fetch friend statuses' });
    }
  });

  app.get('/api/friends/pending', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    const pending = await getPendingFriendRequests(user.id);
    res.json({ pending });
  });

  app.get('/api/users/search', requireAuth, async (req: Request, res: Response) => {
    const query = req.query.q as string;
    const currentUser = req.user!;
    if (!query || query.length < 2) return res.json({ users: [] });
    try {
      const results = await searchUsers(query, currentUser.id);
      const withStatus = await Promise.all(
        results.map(async (u: UserInternal) => {
          const friendStatus = await isFriend(currentUser.id, u.id);
          const safe = sanitizeUser(u);
          return { ...safe, isFriend: friendStatus };
        })
      );
      res.json({ users: withStatus });
    } catch (_) {
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.get('/api/friends', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    const friends = await getFriends(user.id);
    res.json({ friends });
  });

  app.post('/api/friends/request', requireAuth, async (req: Request, res: Response) => {
    const { targetUserId } = req.body;
    const user = req.user!;
    await sendFriendRequest(user.id, targetUserId);
    res.json({ success: true });
  });

  app.post('/api/friends/accept', requireAuth, async (req: Request, res: Response) => {
    const { targetUserId } = req.body;
    const user = req.user!;
    await acceptFriendRequest(user.id, targetUserId);
    res.json({ success: true });
  });

  app.get('/api/user/:userId', requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    const user = await getUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isFriendStatus = await isFriend(currentUser.id, user.id);

    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword, isFriend: isFriendStatus });
  });

  app.delete('/api/friends/:targetUserId', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    await removeFriend(user.id, req.params.targetUserId);
    res.json({ success: true });
  });

  app.post('/api/friends/invite/:friendId', requireAuth, async (req: Request, res: Response) => {
    const { roomId } = req.body;
    const user = req.user!;

    const friendSocketId = await getSocketId(req.params.friendId, userSockets);
    if (friendSocketId) {
      io.to(friendSocketId).emit('friendInvite', {
        fromUserId: user.id,
        fromUsername: user.username,
        roomId,
      });
    }
    res.json({ success: true });
  });
}

