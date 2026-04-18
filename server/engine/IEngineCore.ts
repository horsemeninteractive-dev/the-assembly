/**
 * engine/IEngineCore.ts
 *
 * Minimal structural interface that all sub-engines accept as their
 * "back-reference" to the orchestrator. Using an interface (instead of
 * importing the concrete GameEngine class) breaks the circular dependency
 * cleanly: sub-engines import IEngineCore, GameEngine satisfies it.
 *
 * Only the methods that sub-engines actually call on the orchestrator are
 * listed here. The concrete GameEngine class may expose more.
 */

import { Server } from 'socket.io';
import { GameState, Player, Policy, GamePhase, TitleAbilityData, SystemConfig } from '../../shared/types';
import type { PostRoundContinuation } from './TitleRoleResolver';

// ── Forward declarations for sub-engine shapes ───────────────────────────────

export interface IAIEngine {
  scheduleAITurns(s: GameState, roomId: string): void;
  processAITurns(roomId: string): void;
  postAIChat(state: GameState, ai: Player, lines: readonly string[], targetName?: string): void;
  triggerAIReactions(
    state: GameState,
    roomId: string,
    type: 'nomination' | 'enactment' | 'failed_vote',
    context?: { targetId?: string }
  ): void;
}

export interface IRoundManager {
  /** Direct entry point — phase transition, resets hasActed, fires timers + AI */
  enterPhase(s: GameState, roomId: string, phase: GamePhase): void;
  clearActionTimer(roomId: string): void;
  startActionTimer(roomId: string, durationMs?: number): void;
  /** Safe public wrapper used by restoreFromRedis */
  fireActionTimerExpiry(s: GameState, roomId: string): Promise<void>;
  resetPlayerActions(s: GameState): void;
  resetPlayerHasActed(s: GameState): void;
  fillWithAI(roomId: string): void;
  startGame(roomId: string): void;
  startNomination(state: GameState, roomId: string): void;
  nominateChancellor(s: GameState, roomId: string, chancellorId: string, presidentId: string): void;
  getEligibleChancellors(s: GameState, presidentId: string): Player[];
  advanceToVotingOrBroker(s: GameState, roomId: string): void;
  tallyVotes(s: GameState, roomId: string): void;
  handleVoteResult(s: GameState, roomId: string): void;
  handlePresidentDiscard(s: GameState, roomId: string, presidentId: string, idx: number): void;
  handleChancellorPlay(s: GameState, roomId: string, chancellorId: string, idx: number): void;
  enactPolicy(s: GameState, roomId: string, policy: Policy, isChaos: boolean, playerId?: string): void;
  autoDeclareMissing(s: GameState, roomId: string): void;
  onBothDeclared(s: GameState, roomId: string): void;
  checkRoundEnd(s: GameState, roomId: string): void;
  runExecutiveAction(s: GameState, roomId: string): void;
  handleExecutiveAction(s: GameState, roomId: string, targetId: string, presidentId?: string): Promise<void>;
  applyExecutiveAction(s: GameState, roomId: string, targetId: string): Promise<void>;
  handleVetoResponse(s: GameState, roomId: string, player: Player, agree: boolean): void;
  captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void;
  resetRoom(roomId: string): Promise<void>;
  drainSpectatorQueue(roomId: string): Promise<void>;
  tallyCensure(s: GameState, roomId: string): void;
  nextRound(state: GameState, roomId: string, successfulGovernment?: boolean, skipAdvance?: boolean): void;
  handleElectionFailureContinuation(s: GameState, roomId: string): Promise<void>;
}

export interface ICrisisEngine {
  initDeck(roomId: string): void;
  drawEventCard(s: GameState, roomId: string): void;
  clearEventCard(s: GameState): void;
  cleanup(roomId: string): void;
}

export interface ITitleRoleResolver {
  assignTitleRoles(state: GameState, pool?: import('../../shared/types').TitleRole[]): void;
  runPostRoundTitleAbilities(s: GameState, roomId: string): void;
  continuePostRoundAfter(s: GameState, roomId: string, after: PostRoundContinuation): void;
  handleTitleAbility(s: GameState, roomId: string, abilityData: TitleAbilityData): Promise<void>;
}

export interface IMatchCloser {
  checkVictory(s: GameState, roomId: string): Promise<boolean>;
  endGame(s: GameState, roomId: string, winner: 'Civil' | 'State', reason: string): Promise<void>;
  updateUserStats(s: GameState, winningSide?: 'Civil' | 'State', leaverId?: string): Promise<void>;
}

export interface IGameBroadcaster {
  broadcastState(roomId: string): void;
  deleteRoom(roomId: string): void;
  clearDelayedSpectatorEmissions(roomId: string): void;
  clearAllRedisRooms(): Promise<void>;
  updateRoomAverageElo(state: GameState): Promise<void>;
}

// ── Main orchestrator interface ───────────────────────────────────────────────

export interface IEngineCore {
  readonly io: Server;
  readonly rooms: Map<string, GameState>;
  getConfig(): SystemConfig;

  // Sub-engine access
  readonly aiEngine: IAIEngine;
  readonly roundManager: IRoundManager;
  readonly titleRoleResolver: ITitleRoleResolver;
  readonly matchCloser: IMatchCloser;
  readonly broadcaster: IGameBroadcaster;
  readonly crisisEngine: ICrisisEngine;

  // Convenience pass-throughs exposed on the orchestrator
  broadcastState(roomId: string): void;
  enterPhase(s: GameState, roomId: string, phase: GamePhase): void;
  startActionTimer(roomId: string, durationMs?: number): void;
  clearActionTimer(roomId: string): void;
  deleteRoom(roomId: string): void;
  updateRoomAverageElo(state: GameState): Promise<void>;
  updateUserStats(s: GameState, winningSide?: 'Civil' | 'State', leaverId?: string): Promise<void>;
  runExecutiveAction(s: GameState, roomId: string): void;
}

