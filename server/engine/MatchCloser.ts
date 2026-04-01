/**
 * engine/MatchCloser.ts
 *
 * Owns end-of-game logic:
 *   - Victory condition checking (directive counts, manual triggers)
 *   - endGame() — sets phase to GameOver, fires stats
 *   - updateUserStats() — ELO, XP, IP, CP, achievements, match records, socket emissions
 */

import { randomUUID } from 'crypto';
import { GameState, UserInternal, RecentlyPlayedEntry } from '../../src/types.ts';
import { logger } from '../logger.ts';
import { getUserById, saveUser, saveMatchResult, incrementGlobalWin, saveMatchAndUserAtomic } from '../supabaseService.ts';
import { calculateXpGain } from '../../src/lib/xp.ts';
import { inFlightWrites } from '../../server.ts';
import { checkAchievements } from '../achievements.ts';
import { ACHIEVEMENT_MAP } from '../../src/lib/achievements.ts';
import { AGENDA_MAP } from '../personalAgendas.ts';
import { computeEloChange } from './utils.ts';
import type { IEngineCore } from './IEngineCore.ts';

export class MatchCloser {
  constructor(private readonly engine: IEngineCore) {}

  async checkVictory(s: GameState, roomId: string): Promise<boolean> {
    if (s.civilDirectives >= 5) {
      await this.endGame(s, roomId, 'Civil', 'CHARTER RESTORED');
      return true;
    }
    if (s.stateDirectives >= 6) {
      await this.endGame(s, roomId, 'State', 'STATE SUPREMACY');
      return true;
    }
    return false;
  }

  async endGame(
    s: GameState,
    roomId: string,
    winner: 'Civil' | 'State',
    reason: string
  ): Promise<void> {
    s.phase = 'GameOver';
    s.winner = winner;
    s.winReason = reason;
    s.log.push(`Game over: ${reason}`);
    if (s.log.length > 50) s.log.shift();
    this.engine.clearActionTimer(roomId);
    
    // Register the asynchronous stat updates in the global in-flight write Set for graceful shutdown
    const writePromise = this.updateUserStats(s, winner)
      .catch(err => logger.error({ err }, 'updateUserStats failure during endGame'))
      .finally(() => inFlightWrites.delete(writePromise));
    
    inFlightWrites.add(writePromise);

    if (winner) await incrementGlobalWin(winner);
    this.engine.broadcastState(roomId);
  }

  async updateUserStats(
    s: GameState,
    winningSide?: 'Civil' | 'State',
    leaverId?: string
  ): Promise<void> {
    const humanPlayers = s.players.filter((p) => !p.isAI && p.userId);
    if (humanPlayers.length === 0) return;

    const fetched = await Promise.all(humanPlayers.map((p) => getUserById(p.userId!)));
    const userMap = new Map<string, UserInternal>();
    for (let i = 0; i < humanPlayers.length; i++) {
      const u = fetched[i];
      if (u) userMap.set(humanPlayers[i].userId!, u);
    }

    const validUsers = Array.from(userMap.values());
    const now = new Date().toISOString();

    type PlayerResult = {
      playerId: string;
      user: UserInternal;
      won: boolean;
      eloChange: number;
      eloBeforeCalc: number;
      xpEarned: number;
      ipEarned: number;
      cpEarned: number;
      agendaCompleted: boolean;
      agendaName: string | undefined;
      newAchievementIds: string[];
      opponentAverageElo: number;
      matchRecord: Parameters<typeof saveMatchResult>[0];
    };
    const results: PlayerResult[] = [];

    const civilElos = humanPlayers
      .filter((p) => p.role === 'Civil')
      .map((p) => userMap.get(p.userId!)?.stats.elo ?? 1000);
    const stateElos = humanPlayers
      .filter((p) => p.role === 'State' || p.role === 'Overseer')
      .map((p) => userMap.get(p.userId!)?.stats.elo ?? 1000);
    const avgCivilElo = civilElos.length
      ? Math.round(civilElos.reduce((a, b) => a + b, 0) / civilElos.length)
      : 1000;
    const avgStateElo = stateElos.length
      ? Math.round(stateElos.reduce((a, b) => a + b, 0) / stateElos.length)
      : 1000;

    const isInconclusive = !winningSide;

    for (const p of humanPlayers) {
      const user = userMap.get(p.userId!);
      if (!user) continue;

      const isLeaver = isInconclusive && p.id === leaverId;
      const won =
        !isInconclusive &&
        ((winningSide === 'Civil' && p.role === 'Civil') ||
          (winningSide === 'State' && (p.role === 'State' || p.role === 'Overseer')));

      const oldXp = user.stats.xp;
      const oldIp = user.stats.points;
      const eloBeforeCalc = user.stats.elo;

      let eloChange = 0;
      let xpEarned = 0;
      let ipEarned = 0;
      let cpEarned = 0;
      let agendaCompleted = false;
      let newAchievementIds: string[] = [];
      const opponentAvgElo = p.role === 'Civil' ? avgStateElo : avgCivilElo;

      if (!isInconclusive) {
        user.stats.gamesPlayed++;
        if (p.role === 'Civil') user.stats.civilGames++;
        else if (p.role === 'State') user.stats.stateGames++;
        else if (p.role === 'Overseer') user.stats.overseerGames++;

        if (won) {
          user.stats.wins++;
          if (p.role === 'Civil') user.stats.civilWins = (user.stats.civilWins ?? 0) + 1;
          if (p.role === 'State') user.stats.stateWins = (user.stats.stateWins ?? 0) + 1;
          if (p.role === 'Overseer') user.stats.overseerWins = (user.stats.overseerWins ?? 0) + 1;
        } else {
          user.stats.losses++;
        }

        if (s.mode === 'Ranked') {
          user.stats.rankedGames = (user.stats.rankedGames ?? 0) + 1;
          if (won) user.stats.rankedWins = (user.stats.rankedWins ?? 0) + 1;
          eloChange = computeEloChange(user.stats.elo, opponentAvgElo, won, user.stats.gamesPlayed);
        } else if (s.mode === 'Classic') {
          user.stats.classicGames = (user.stats.classicGames ?? 0) + 1;
          if (won) user.stats.classicWins = (user.stats.classicWins ?? 0) + 1;
        } else {
          user.stats.casualGames = (user.stats.casualGames ?? 0) + 1;
          if (won) user.stats.casualWins = (user.stats.casualWins ?? 0) + 1;
        }

        user.stats.elo = Math.max(0, user.stats.elo + eloChange);

        const xpGain = calculateXpGain({
          win: won,
          kills: p.role === 'Overseer' ? p.stateEnactments || 0 : 0,
        });

        if (p.personalAgenda) {
          const agendaDef = AGENDA_MAP.get(p.personalAgenda);
          if (agendaDef) {
            agendaCompleted = agendaDef.evaluate(s, p.id) === 'completed';
            if (agendaCompleted) user.stats.agendasCompleted++;
          }
        }

        newAchievementIds = checkAchievements({ user, s, p, won, agendaCompleted });
        let achievementXp = 0;
        let achievementCp = 0;
        if (newAchievementIds.length > 0) {
          if (!user.earnedAchievements) user.earnedAchievements = [];
          for (const id of newAchievementIds) {
            user.earnedAchievements.push({ id, earnedAt: now });
            const def = ACHIEVEMENT_MAP.get(id);
            if (def) {
              achievementXp += def.xpReward;
              achievementCp += def.cpReward;
            }
          }
          user.cabinetPoints = (user.cabinetPoints ?? 0) + achievementCp;
        }

        const config = this.engine.getConfig();
        const xpMult = config.xpMultiplier || 1.0;
        const ipMult = config.ipMultiplier || 1.0;

        const baseIp = won ? (s.mode === 'Ranked' ? 100 : 40) : s.mode === 'Ranked' ? 25 : 10;
        const agendaIp = agendaCompleted ? (s.mode === 'Ranked' ? 40 : 20) : 0;
        const agendaXp = agendaCompleted ? 100 : 0;

        xpEarned = Math.floor((xpGain + agendaXp + achievementXp) * xpMult);
        ipEarned = Math.floor((baseIp + agendaIp) * ipMult);
        cpEarned = achievementCp;

        user.stats.xp = oldXp + xpEarned;
        user.stats.points = oldIp + ipEarned;
      } else if (isLeaver) {
        user.stats.gamesPlayed++;
        user.stats.losses++;
        if (s.mode === 'Ranked') {
          user.stats.rankedGames = (user.stats.rankedGames ?? 0) + 1;
          eloChange = computeEloChange(user.stats.elo, opponentAvgElo, false, user.stats.gamesPlayed);
          user.stats.elo = Math.max(0, user.stats.elo + eloChange);
        }
      }

      results.push({
        playerId: p.id,
        user,
        won,
        eloChange,
        eloBeforeCalc,
        xpEarned,
        ipEarned,
        cpEarned,
        agendaCompleted,
        agendaName: p.personalAgenda
          ? (AGENDA_MAP.get(p.personalAgenda)?.name ?? undefined)
          : undefined,
        newAchievementIds,
        opponentAverageElo: opponentAvgElo,
        matchRecord: {
          id: randomUUID(),
          userId: p.userId!,
          playedAt: now,
          roomName: s.roomId,
          mode: s.mode,
          playerCount: s.players.length,
          role: p.role!,
          won,
          winReason: s.winReason ?? '',
          rounds: s.round,
          civilDirectives: s.civilDirectives,
          stateDirectives: s.stateDirectives,
          agendaId: p.personalAgenda,
          agendaName: p.personalAgenda ? AGENDA_MAP.get(p.personalAgenda)?.name : undefined,
          agendaCompleted,
          xpEarned,
          ipEarned,
          cpEarned,
        },
      });
    }

    // Recently Played With
    const snapshots = results.map((r) => ({
      userId: r.user.id,
      entry: {
        userId: r.user.id,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
        activeFrame: r.user.activeFrame,
        elo: r.user.stats.elo,
        lastPlayedAt: now,
      } as RecentlyPlayedEntry,
    }));

    for (const { userId } of snapshots) {
      const u = userMap.get(userId);
      if (!u) continue;
      const existingMap = new Map<string, any>(
        (u.recentlyPlayedWith ?? []).map((e) => [e.userId, e])
      );
      for (const { userId: coId, entry } of snapshots) {
        if (coId === userId) continue;
        existingMap.set(coId, entry);
      }
      u.recentlyPlayedWith = Array.from(existingMap.values())
        .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())
        .slice(0, 20);
    }

    await Promise.all(
      results.map((r) => saveMatchAndUserAtomic(r.user, r.matchRecord))
    );

    for (const r of results) {
      const { password: _, ...safe } = r.user;
      const player = s.players.find((p) => p.id === r.playerId);
      if (player && player.socketId) {
        this.engine.io.to(player.socketId).emit('userUpdate', safe);
        this.engine.io.to(player.socketId).emit('postMatchResult', {
          won: r.won,
          mode: s.mode,
          role: player.role,
          eloChange: r.eloChange,
          eloBefore: r.eloBeforeCalc,
          eloAfter: r.user.stats.elo,
          opponentAverageElo: r.opponentAverageElo,
          xpEarned: r.xpEarned,
          ipEarned: r.ipEarned,
          agendaName: r.agendaName,
          agendaCompleted: r.agendaCompleted,
          rounds: s.round,
          civilDirectives: s.civilDirectives,
          stateDirectives: s.stateDirectives,
          newAchievements: r.newAchievementIds,
        });
      }
    }
  }
}
