/**
 * engine/MatchCloser.ts
 *
 * Owns end-of-game logic:
 *   - Victory condition checking (directive counts, manual triggers)
 *   - endGame() — sets phase to GameOver, fires stats
 *   - updateUserStats() — ELO, XP, IP, CP, achievements, match records, socket emissions
 */

import { randomUUID } from 'crypto';
import { GameState, UserInternal, RecentlyPlayedEntry } from '../../shared/types';
import { logger } from '../logger';
import { getUserById, saveUser, saveMatchResult, incrementGlobalWin, saveMatchAndUserAtomic } from '../supabaseService';
import { contributeClanXp, getClanById, saveClanChallenges, incrementClanXp } from '../db/clans';
import { refreshClanChallenges, evaluateClanChallenges, ClanChallengeContext, calculateClanXpGain } from '../game/clanChallenges';
import { calculateXpGain, getLevelFromXp } from '../../src/utils/xp';
import { inFlightWrites } from '../../server';
import { checkAchievements } from '../achievements';
import { refreshChallenges, saveChallengeData } from '../db/challenges';
import { ChallengeContext, evaluateChallenges } from '../game/challenges';
import { ACHIEVEMENT_MAP } from '../../src/utils/achievements';
import { AGENDA_MAP } from '../game/personalAgendas';
import { computeEloChange } from './utils';
import type { IEngineCore } from './IEngineCore';

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
      completedChallengeIds: { id: import('../../shared/types').ChallengeId; xpReward: number; ipReward: number }[];
      clanXpEarned: number;
      opponentAverageElo: number;
      matchRecord: Parameters<typeof saveMatchResult>[0];
    };
    const results: PlayerResult[] = [];
    const clanChallengesToSave = new Map<string, import('../../shared/types').ClanChallengeData>();
    const userClanXp = new Map<string, number>(); // userId -> xp amount to contribute

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
      let challengeResult: ReturnType<typeof evaluateChallenges> | undefined;
      let clanXpEarned = 0;
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

        // ── Challenge evaluation ─────────────────────────────────────────
        const challengeCtx: ChallengeContext = { s, p, won, agendaCompleted };
        const freshChallengeData = refreshChallenges(user);
        challengeResult = evaluateChallenges(freshChallengeData, challengeCtx);
        user.challengeData = challengeResult.updatedChallengeData;

        if (challengeResult.completedThisGame.length > 0) {
          logger.info({ 
            userId: user.id, 
            challenges: challengeResult.completedThisGame.map(c => c.id),
            totalXp: challengeResult.totalXp
          }, 'User completed individual challenges');
        } else {
          logger.debug({ userId: user.id }, 'No individual challenges completed this game');
        }

        xpEarned = Math.floor((xpGain + agendaXp + achievementXp) * xpMult);
        ipEarned = Math.floor((baseIp + agendaIp) * ipMult);
        // Challenge rewards are fixed bonuses — not subject to multipliers
        xpEarned += challengeResult.totalXp;
        ipEarned += challengeResult.totalIp;
        cpEarned = achievementCp;

        // ── Clan Challenge evaluation ────────────────────────────────────
        if (user.clan?.id) {
          try {
            const clanId = user.clan.id;
            let clanData = clanChallengesToSave.get(clanId);
            if (!clanData) {
              const fetchedClan = await getClanById(clanId);
              if (fetchedClan) {
                clanData = refreshClanChallenges(fetchedClan.challenges);
              }
            }

            if (clanData) {
              const clanCtx: ClanChallengeContext = { s, p, won, agendaCompleted };
              const clanResult = evaluateClanChallenges(clanData, clanCtx);
              clanChallengesToSave.set(clanId, clanResult.updated);
              
              // New: Each game played contributes XP to the clan directly
              const baseClanXp = calculateClanXpGain(clanCtx);
              const totalContribution = baseClanXp + clanResult.xpReward;
              if (totalContribution > 0) {
                userClanXp.set(user.id, totalContribution);
              }
              clanXpEarned = totalContribution;
            }
          } catch (err) {
            logger.error({ err, userId: user.id }, 'Clan challenge evaluation failed');
          }
        }

        const levelBefore = getLevelFromXp(oldXp);
        user.stats.xp = oldXp + xpEarned;
        const levelAfter = getLevelFromXp(user.stats.xp);

        // ── Referral milestone check ─────────────────────────────────────
        if (levelBefore < 15 && levelAfter >= 15 && user.referredBy && !user.referralProcessed) {
          try {
            const referrer = await getUserById(user.referredBy);
            if (referrer) {
              const reward = 150;
              referrer.cabinetPoints = (referrer.cabinetPoints || 0) + reward;
              await saveUser(referrer);
              logger.info({ 
                userId: user.id, 
                referrerId: referrer.id, 
                reward 
              }, `Referral milestone reached: ${user.username} hit lvl 15. Referrer ${referrer.username} rewarded.`);
            }
            user.referralProcessed = true;
            user.cabinetPoints = (user.cabinetPoints || 0) + 150; // New player also gets reward
          } catch (err) {
            logger.error({ err, userId: user.id }, 'Referral processing error');
          }
        }
        
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
        completedChallengeIds: challengeResult?.completedThisGame ?? [],
        clanXpEarned,
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

    // ── Individual Writes ──────────────────────────────────────────────────
    logger.info({ 
      room: s.roomId, 
      count: results.length,
      clanChallenges: clanChallengesToSave.size 
    }, 'Saving match results for all players');

    await Promise.all([
      // saveMatchAndUserAtomic already includes challenges_data via mapUserToSupabase
      ...results.map((r) => saveMatchAndUserAtomic(r.user, r.matchRecord)),
      ...Array.from(clanChallengesToSave.entries()).map(([cid, data]) => 
        saveClanChallenges(cid, data)
      ),
      ...Array.from(userClanXp.entries()).map(([uid, amount]) =>
        contributeClanXp(uid, amount)
      ),
    ]);

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
          cpEarned: r.cpEarned,
          clanXpEarned: r.clanXpEarned,
          agendaName: r.agendaName,
          agendaCompleted: r.agendaCompleted,
          rounds: s.round,
          civilDirectives: s.civilDirectives,
          stateDirectives: s.stateDirectives,
          newAchievements: r.newAchievementIds,
          completedChallenges: r.completedChallengeIds,
        });
      }
    }
  }
}

