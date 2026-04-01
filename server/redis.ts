/**
 * redis.ts — Redis client setup for game state persistence and Socket.IO adapter.
 *
 * Two clients are created (required by @socket.io/redis-adapter):
 *  - pubClient: used by the Socket.IO adapter to publish events
 *  - subClient: used by the Socket.IO adapter to subscribe to events
 *
 * A third client (stateClient) is used for game state read/write so it is
 * never blocked by the adapter's pub/sub traffic.
 *
 * All three are created from the same REDIS_URL env variable. If REDIS_URL is
 * not set the module exports null clients and the server falls back to
 * in-memory-only mode (single-instance, no persistence across restarts).
 */

import Redis from 'ioredis';
import { logger } from './logger.ts';

const REDIS_URL = process.env.REDIS_URL;

export const isRedisConfigured = !!REDIS_URL;

function createClient(): Redis | null {
  if (!REDIS_URL) return null;
  const client = new Redis(REDIS_URL, {
    // Reconnect with exponential backoff, cap at 10s
    retryStrategy: (times) => Math.min(times * 200, 10_000),
    maxRetriesPerRequest: null, // required for blocking commands
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on('error', (err) => logger.error({ err: err.message }, '[Redis] error'));
  client.on('connect', () => logger.info('[Redis] connected'));
  return client;
}

export const pubClient = createClient();
export const subClient = createClient();
export const stateClient = createClient();

/** Redis key for a room's GameState */
export const roomKey = (roomId: string): string => `room:${roomId}`;

/** How long to keep an idle room in Redis before auto-expiry (24 hours) */
export const ROOM_TTL_SECONDS = 60 * 60 * 24;

/** Returns the current raw connection status of the Redis pubClient. */
export function getRedisStatus(): string {
  if (!REDIS_URL || !pubClient) return 'disabled';
  return (pubClient as any).status || 'unknown';
}

/** Checks if Redis is currently connected and ready. */
export function isRedisAlive(): boolean {
  return getRedisStatus() === 'ready';
}

/** Redis key for a user's current socket ID and online status */
export const userStatusKey = (userId: string): string => `user:online:${userId}`;

/** How long to keep a user's online status in Redis (3 minutes default heartbeat) */
export const USER_STATUS_TTL_SECONDS = 180;

/** Sets a user's socket ID in Redis with an expiry. */
export async function setUserSocketId(userId: string, socketId: string): Promise<void> {
  if (!stateClient) return;
  await stateClient.set(userStatusKey(userId), socketId, 'EX', USER_STATUS_TTL_SECONDS);
}

/** Retrieves a user's socket ID from Redis. */
export async function getUserSocketId(userId: string): Promise<string | null> {
  if (!stateClient) return null;
  return await stateClient.get(userStatusKey(userId));
}

/** 
 * Retrieves a user's socket ID with local cache fallback.
 * Authoritative: Redis (multiple instances).
 * Fallback: local Map (this instance only).
 */
export async function getSocketId(userId: string, localCache?: Map<string, string>): Promise<string | null> {
  const redisId = await getUserSocketId(userId);
  if (redisId) return redisId;
  return localCache?.get(userId) || null;
}

/** Refreshes the TTL of a user's online status. */
export async function refreshUserStatus(userId: string): Promise<void> {
  if (!stateClient) return;
  await stateClient.expire(userStatusKey(userId), USER_STATUS_TTL_SECONDS);
}

/** Removes a user's online status from Redis if it matches the provided socketId. */
export async function removeUserSocketId(userId: string, socketId: string): Promise<void> {
  if (!stateClient) return;
  const current = await stateClient.get(userStatusKey(userId));
  if (current === socketId) {
    await stateClient.del(userStatusKey(userId));
  }
}

/** Redis key for single-use OAuth exchange code */
export const oauthExchangeKey = (code: string): string => `auth:exchange:${code}`;
const EXCHANGE_CODE_TTL = 60; // 60 seconds

export async function setOAuthExchangeCode(code: string, data: { userId: string; token: string }): Promise<void> {
  if (!stateClient) return;
  await stateClient.set(oauthExchangeKey(code), JSON.stringify(data), 'EX', EXCHANGE_CODE_TTL);
}

export async function consumeOAuthExchangeCode(code: string): Promise<{ userId: string; token: string } | null> {
  if (!stateClient) return null;
  const key = oauthExchangeKey(code);
  const data = await stateClient.get(key);
  if (data) {
    await stateClient.del(key);
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/** Redis keys for room creation rate limiting */
export const roomCooldownKey = (userId: string): string => `user:room-cooldown:${userId}`;
export const roomCountKey = (userId: string): string => `user:room-count:${userId}`;

export async function checkRoomCreationLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!stateClient) return { allowed: true };
  
  const onCooldown = await stateClient.get(roomCooldownKey(userId));
  if (onCooldown) {
    return { allowed: false, reason: 'Please wait 30 seconds between creating rooms.' };
  }
  
  const count = parseInt(await stateClient.get(roomCountKey(userId)) || '0', 10);
  if (count >= 3) {
    return { allowed: false, reason: 'You can only have 3 active rooms as host at a time.' };
  }
  
  return { allowed: true };
}

export async function recordRoomCreation(userId: string): Promise<void> {
  if (!stateClient) return;
  await stateClient.set(roomCooldownKey(userId), '1', 'EX', 30);
  await stateClient.incr(roomCountKey(userId));
  // Ensure the count key doesn't live forever if a room deletion is missed
  await stateClient.expire(roomCountKey(userId), 60 * 60 * 24);
}

export async function recordRoomDeletion(userId: string): Promise<void> {
  if (!stateClient) return;
  const count = parseInt(await stateClient.get(roomCountKey(userId)) || '0', 10);
  if (count > 0) {
    await stateClient.decr(roomCountKey(userId));
  }
}

/** Redis key for OAuth CSRF nonce */
export const oauthNonceKey = (nonce: string): string => `auth:nonce:${nonce}`;
const NONCE_TTL = 300; // 5 minutes

export async function setOAuthNonce(nonce: string): Promise<void> {
  if (!stateClient) return;
  await stateClient.set(oauthNonceKey(nonce), '1', 'EX', NONCE_TTL);
}

export async function verifyOAuthNonce(nonce: string): Promise<boolean> {
  if (!stateClient) return false;
  const key = oauthNonceKey(nonce);
  const exists = await stateClient.get(key);
  if (exists) {
    await stateClient.del(key);
    return true;
  }
  return false;
}
