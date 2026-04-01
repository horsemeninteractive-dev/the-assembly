/**
 * engine/GameBroadcaster.ts
 *
 * Owns all outbound emission logic:
 *   - Per-recipient state tailoring (role visibility, card masking)
 *   - Ranked spectator 10-second delay
 *   - Redis write-through persistence on every broadcast
 *   - Room deletion from memory + Redis
 */

import { Server } from 'socket.io';
import { GameState, Policy, SystemConfig } from '../../shared/types';
import { logger } from '../logger';
import { stateClient, roomKey, ROOM_TTL_SECONDS, isRedisConfigured, recordRoomDeletion } from '../redis';
import { getPlayerAgenda, AGENDA_MAP } from '../game/personalAgendas';
import { getUsersByIds } from '../supabaseService';

export class GameBroadcaster {
  /** Pending delayed emissions for spectators (anti-cheat). */
  private delayedSpectatorEmissions: Map<string, Set<ReturnType<typeof setTimeout>>> = new Map();

  /** Debounce timers for Redis writes to reduce serialisation pressure. */
  private redisDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private readonly io: Server,
    private readonly rooms: Map<string, GameState>
  ) {}

  // ---------------------------------------------------------------------------
  // Core broadcast
  // ---------------------------------------------------------------------------

  broadcastState(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state) return;

    const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) return;

    // Strip sensitive card fields from the base payload upfront.
    // pendingChancellorClaim is pure AI coordination and is NEVER sent to any client.
    const {
      deck,
      discard,
      drawnPolicies,
      chancellorPolicies,
      presidentSaw,
      chancellorSaw,
      pendingChancellorClaim: _neverSent,
      ...publicState
    } = state;

    for (const socketId of roomSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const isSpectator = state.spectators.some((s) => s.id === socketId);
      const isAdmin = socket.data?.isAdmin === true;
      const isGameOver = state.phase === 'GameOver';
      const seeAllCards = isAdmin || isSpectator || isGameOver;

      const player = state.players.find((pl) => pl.socketId === socketId);
      const isPresident = player?.isPresident === true;
      const isChancellor = player?.isChancellor === true;

      const tailoredPlayers = state.players.map((p) => {
        const { role, titleRole, personalAgenda, ...rest } = p;
        if (isGameOver) return { ...rest, role, titleRole, personalAgenda };
        if (isAdmin || isSpectator) return { ...rest, role, titleRole, personalAgenda };
        if (p.socketId === socketId) return { ...rest, role, titleRole, personalAgenda };
        return rest;
      });

      const tailoredSpectatorRoles =
        isSpectator || isAdmin || isGameOver
          ? Object.fromEntries(
              state.players.map((p) => [
                p.id,
                {
                  role: p.role ?? 'Unknown',
                  titleRole: p.titleRole,
                  agendaName: p.personalAgenda
                    ? (AGENDA_MAP.get(p.personalAgenda)?.name ?? p.personalAgenda)
                    : undefined,
                },
              ])
            )
          : undefined;

      const payload = {
        ...publicState,
        players: tailoredPlayers,
        spectatorRoles: tailoredSpectatorRoles,
        deck: seeAllCards ? deck : (new Array(deck.length).fill('Civil') as Policy[]),
        discard: seeAllCards ? discard : (new Array(discard.length).fill('Civil') as Policy[]),
        drawnPolicies: seeAllCards || isPresident ? drawnPolicies : [],
        chancellorPolicies: seeAllCards || isChancellor ? chancellorPolicies : [],
        presidentSaw: seeAllCards || isPresident ? presidentSaw : undefined,
        chancellorSaw: seeAllCards || isChancellor ? chancellorSaw : undefined,
      };

      const isRanked = state.mode === 'Ranked';
      const shouldDelay = isSpectator && isRanked && !isGameOver;

      const emitUpdate = () => {
        const currentSocket = this.io.sockets.sockets.get(socketId);
        if (currentSocket) {
          currentSocket.emit('gameStateUpdate', payload);

          if (player && !player.isAI && player.role && !isGameOver) {
            const stateAgents = state.players
              .filter((pl) => pl.role === 'State' || pl.role === 'Overseer')
              .map((pl) => ({ id: pl.id, name: pl.name, role: pl.role! }));

            if (
              player.role === 'State' ||
              (player.role === 'Overseer' && state.players.length <= 6)
            ) {
              currentSocket.emit('privateInfo', {
                role: player.role,
                stateAgents,
                titleRole: player.titleRole,
                personalAgenda: getPlayerAgenda(state, player.id),
              });
            } else {
              currentSocket.emit('privateInfo', {
                role: player.role,
                titleRole: player.titleRole,
                personalAgenda: getPlayerAgenda(state, player.id),
              });
            }
          }
        }
      };

      if (shouldDelay) {
        if (!this.delayedSpectatorEmissions.has(roomId)) {
          this.delayedSpectatorEmissions.set(roomId, new Set());
        }
        const timeouts = this.delayedSpectatorEmissions.get(roomId)!;
        const handle = setTimeout(() => {
          timeouts.delete(handle);
          emitUpdate();
        }, 10000);
        timeouts.add(handle);
      } else {
        emitUpdate();
      }
    }

    // Persist state to Redis, debounced to 500ms to reduce write/serialization pressure.
    if (isRedisConfigured && stateClient) {
      if (this.redisDebounceTimers.has(roomId)) {
        clearTimeout(this.redisDebounceTimers.get(roomId));
      }
      const timer = setTimeout(() => {
        this.redisDebounceTimers.delete(roomId);
        const currentState = this.rooms.get(roomId);
        if (!currentState || !stateClient) return; // Room was deleted in between the debounce window

        stateClient
          .set(roomKey(roomId), JSON.stringify(currentState), 'EX', ROOM_TTL_SECONDS)
          .catch((err) =>
            logger.error({ roomId, err: err.message }, 'Failed to persist room to Redis')
          );
      }, 500);
      this.redisDebounceTimers.set(roomId, timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Room deletion
  // ---------------------------------------------------------------------------

  deleteRoom(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (state && state.hostUserId) {
      recordRoomDeletion(state.hostUserId).catch(() => {});
    }
    this.rooms.delete(roomId);
    this.clearDelayedSpectatorEmissions(roomId);

    if (this.redisDebounceTimers.has(roomId)) {
      clearTimeout(this.redisDebounceTimers.get(roomId));
      this.redisDebounceTimers.delete(roomId);
    }

    if (isRedisConfigured && stateClient) {
      stateClient
        .del(roomKey(roomId))
        .catch((err) =>
          logger.error({ roomId, err: err.message }, 'Failed to delete room from Redis')
        );
    }
  }

  clearDelayedSpectatorEmissions(roomId: string): void {
    const timeouts = this.delayedSpectatorEmissions.get(roomId);
    if (timeouts) {
      for (const h of timeouts) clearTimeout(h);
      this.delayedSpectatorEmissions.delete(roomId);
    }
  }

  // ---------------------------------------------------------------------------
  // Redis utilities
  // ---------------------------------------------------------------------------

  async clearAllRedisRooms(): Promise<void> {
    if (!isRedisConfigured || !stateClient) return;
    let cursor = '0';
    const found: string[] = [];
    do {
      const [next, keys] = await stateClient.scan(cursor, 'MATCH', 'room:*', 'COUNT', 100);
      cursor = next;
      found.push(...keys);
    } while (cursor !== '0');
    if (found.length > 0) {
      await stateClient.del(...found);
      logger.info({ count: found.length }, 'Purged stale rooms from Redis');
    }
  }

  // ---------------------------------------------------------------------------
  // ELO cache
  // ---------------------------------------------------------------------------

  async updateRoomAverageElo(state: GameState): Promise<void> {
    const humanPlayers = state.players.filter((p) => !p.isAI && p.userId);
    if (humanPlayers.length === 0) {
      state.averageElo = undefined;
      return;
    }
    try {
      const users = await getUsersByIds(humanPlayers.map((p) => p.userId!));
      const elos = humanPlayers.map((p) => {
        const user = users.find((u) => u.id === p.userId);
        return user?.stats?.elo ?? 1000;
      });
      state.averageElo = Math.round(elos.reduce((a, b) => a + b, 0) / elos.length);
    } catch (err) {
      logger.error({ roomId: state.roomId, err }, 'Failed to update average ELO');
    }
  }
}

