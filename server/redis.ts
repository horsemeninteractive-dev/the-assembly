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

import Redis from "ioredis";

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
  client.on("error", (err) => console.error("[Redis] error:", err.message));
  client.on("connect", () => console.log("[Redis] connected"));
  return client;
}

export const pubClient   = createClient();
export const subClient   = pubClient?.duplicate() ?? null;
export const stateClient = pubClient?.duplicate() ?? null;

/** Redis key for a room's GameState */
export const roomKey = (roomId: string): string => `room:${roomId}`;

/** How long to keep an idle room in Redis before auto-expiry (24 hours) */
export const ROOM_TTL_SECONDS = 60 * 60 * 24;
