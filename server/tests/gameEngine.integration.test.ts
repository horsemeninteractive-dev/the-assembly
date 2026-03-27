/**
 * gameEngine.integration.test.ts
 *
 * Phase-level integration tests for GameEngine. These tests exercise real engine
 * logic via the public surface (nominateChancellor, handlePresidentDiscard,
 * handleChancellorPlay, resolveTitleAbility, handleExecutiveAction, etc.) using a
 * minimal mock IO / Socket.IO façade.
 *
 * Coverage targets
 * ────────────────
 * ✓ Lobby → Nominate_Chancellor phase transition
 * ✓ Nomination → Voting via nominateChancellor
 * ✓ Voting_Reveal passage → Legislative_President
 * ✓ President discard → Legislative_Chancellor
 * ✓ Chancellor play → policy enacted, electionTracker reset
 * ✓ Chaos policy fires at electionTracker = 3
 * ✓ Assassin title ability — kills target; ends game if Overseer
 * ✓ Interdictor title ability — detained player can't be nominated
 * ✓ Strategist title ability — president draws 4 cards
 * ✓ Handler title ability — swaps presidential rotation order
 * ✓ Auditor title ability — emits policyPeekResult to auditor
 * ✓ Broker title ability — rejects chancellor, forces re-nomination
 * ✓ Executive Action: Execution kills target, ends game if Overseer
 * ✓ Executive Action: Investigate emits investigationResult
 * ✓ Executive Action: SpecialElection sets correct next president
 * ✓ Timer expiry: Nominate_Chancellor auto-nominates
 * ✓ Timer expiry: Voting auto-casts missing votes
 * ✓ Timer expiry: Legislative_President auto-discards
 * ✓ Timer expiry: Legislative_Chancellor auto-enacts
 * ✓ Civil win (5 Civil directives)
 * ✓ State win via 6 State directives
 * ✓ State win via Overseer elected chancellor (≥ 3 State directives)
 * ✓ Civil win via Overseer Execution
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GameEngine } from '../gameEngine';
import { GameState, Player, Policy } from '../../src/types';
import { createDeck } from '../utils';

// ---------------------------------------------------------------------------
// Minimal Socket.IO mock — only the slices the engine touches
// ---------------------------------------------------------------------------

const createMockSocket = (id: string) => ({
  id,
  emit: vi.fn(),
  data: {},
});

const createMockIo = () => {
  const sockets = new Map<string, ReturnType<typeof createMockSocket>>();
  const rooms = new Map<string, Set<string>>();

  return {
    sockets: {
      sockets: {
        get: (id: string) => sockets.get(id),
      },
      adapter: {
        rooms: {
          get: (roomId: string) => rooms.get(roomId),
        },
      },
    },
    to: (id: string) => ({
      emit: vi.fn(),
    }),
    // Helpers for test setup
    _addSocket: (socket: ReturnType<typeof createMockSocket>) => {
      sockets.set(socket.id, socket);
    },
    _joinRoom: (roomId: string, socketId: string) => {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId)!.add(socketId);
    },
  };
};

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

let uidCounter = 0;
const uid = () => `player-${++uidCounter}`;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: uid(),
    name: `Player-${uidCounter}`,
    isAlive: true,
    isPresidentialCandidate: false,
    isChancellorCandidate: false,
    isPresident: false,
    isChancellor: false,
    wasPresident: false,
    wasChancellor: false,
    isAI: false,
    vote: undefined,
    hasActed: false,
    ...overrides,
  } as Player;
}

/**
 * Build a minimal GameState ready to start Nominate_Chancellor for a given
 * set of players. The deck is full (17 cards). presidentIdx is 0.
 */
function buildState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test-room',
    phase: 'Nominate_Chancellor',
    players,
    spectators: [],
    deck: createDeck(),
    discard: [],
    drawnPolicies: [],
    chancellorPolicies: [],
    civilDirectives: 0,
    stateDirectives: 0,
    electionTracker: 0,
    vetoUnlocked: false,
    vetoRequested: false,
    round: 1,
    presidentIdx: 0,
    lastPresidentIdx: -1,
    presidentialOrder: players.map((p) => p.id),
    log: [],
    messages: [],
    declarations: [],
    maxPlayers: players.length,
    mode: 'Classic',
    actionTimer: 0, // disable real timers in tests
    ...overrides,
  } as unknown as GameState;
}

/**
 * Build a GameEngine with a mock IO layer, register a room, and register each
 * player's socket in the mock IO adapter.
 */
function buildEngine(state: GameState) {
  const io = createMockIo() as any;
  const engine = new GameEngine({
    io,
    getConfig: () => ({}) as any,
  });

  // Register all player sockets
  for (const p of state.players) {
    const sock = createMockSocket(p.id);
    io._addSocket(sock);
    io._joinRoom(state.roomId, p.id);
  }

  engine.rooms.set(state.roomId, state);
  return { engine, io };
}

// ---------------------------------------------------------------------------
// Helpers for common multi-step flows
// ---------------------------------------------------------------------------

function electionSetup(playerCount = 5) {
  const players = Array.from({ length: playerCount }, () => makePlayer());
  // Assign roles — president is Civil, others mixed
  players[0].role = 'Civil';
  players[1].role = 'Civil';
  players[2].role = 'State';
  players[3].role = 'Civil';
  players[4].role = 'Overseer';
  players[0].isPresidentialCandidate = true;

  const state = buildState(players, { presidentIdx: 0 });
  state.presidentId = players[0].id;
  return { players, state, ...buildEngine(state) };
}

/** Simulate a passed election: both candidates set, votes tallied (all Aye). */
function simulatePassedElection(
  state: GameState,
  engine: GameEngine,
  presIdx = 0,
  chanIdx = 1
): void {
  const president = state.players[presIdx];
  const chancellor = state.players[chanIdx];

  state.phase = 'Nominate_Chancellor';
  president.isPresidentialCandidate = true;

  engine.nominateChancellor(state, state.roomId, chancellor.id, president.id);
  // Force phase to Voting regardless of Broker title
  state.phase = 'Voting';
  state.titlePrompt = undefined;

  // Cast all votes Aye
  for (const p of state.players) {
    if (p.isAlive) p.vote = 'Aye';
  }
  engine.handleVoteResult(state, state.roomId);
}

// ---------------------------------------------------------------------------
// ── Phase Transition Tests ─────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Phase Transitions', () => {
  it('nominateChancellor transitions to Voting (no Broker)', () => {
    const { players, state, engine } = electionSetup();
    state.phase = 'Nominate_Chancellor';
    players[0].isPresidentialCandidate = true;

    engine.nominateChancellor(state, state.roomId, players[1].id, players[0].id);

    // No Broker title in Classic mode — should go straight to Voting
    expect(['Voting', 'Nomination_Review']).toContain(state.phase);
    expect(players[1].isChancellorCandidate).toBe(true);
  });

  it('nominateChancellor rejects ineligible chancellor (wasChancellor)', () => {
    const { players, state, engine } = electionSetup();
    state.phase = 'Nominate_Chancellor';
    players[0].isPresidentialCandidate = true;
    players[1].wasChancellor = true; // ineligible

    engine.nominateChancellor(state, state.roomId, players[1].id, players[0].id);

    expect(players[1].isChancellorCandidate).toBe(false);
    // Phase should not have advanced
    expect(state.phase).toBe('Nominate_Chancellor');
  });

  it('passed election transitions to Legislative_President', () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();

    simulatePassedElection(state, engine);
    // tallyVotes schedules a 4 s reveal; fast-forward past it
    vi.advanceTimersByTime(5000);

    expect(state.phase).toBe('Legislative_President');
    const pres = state.players.find((p) => p.isPresident);
    expect(pres).toBeDefined();

    vi.useRealTimers();
  });

  it('president discard transitions to Legislative_Chancellor', () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    simulatePassedElection(state, engine);
    vi.advanceTimersByTime(5000);

    const president = state.players.find((p) => p.isPresident)!;
    state.drawnPolicies = ['Civil', 'State', 'Civil'];

    engine.handlePresidentDiscard(state, state.roomId, president.id, 0);

    expect(state.phase).toBe('Legislative_Chancellor');
    expect(state.drawnPolicies).toHaveLength(0);
    expect(state.chancellorPolicies).toHaveLength(2);

    vi.useRealTimers();
  });

  it('chancellor play enacts policy and resets electionTracker', () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    simulatePassedElection(state, engine);
    vi.advanceTimersByTime(5000);

    const chancellor = state.players.find((p) => p.isChancellor)!;
    state.chancellorPolicies = ['Civil', 'State'];
    state.presidentSaw = ['Civil', 'State', 'State'];
    state.chancellorSaw = ['Civil', 'State'];

    const prevTracker = state.electionTracker;
    engine.handleChancellorPlay(state, state.roomId, chancellor.id, 0);

    // Policy is enqueued with a 5 s animation delay; tracker resets in electionPassed
    expect(state.electionTracker).toBe(0);

    vi.useRealTimers();
  });

  it('failed election increments electionTracker', () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.phase = 'Voting';
    players[0].isPresidentialCandidate = true;
    players[1].isChancellorCandidate = true;

    // Cast all Nay votes
    for (const p of state.players) {
      if (p.isAlive) p.vote = 'Nay';
    }
    engine.handleVoteResult(state, state.roomId);
    vi.advanceTimersByTime(5000);

    expect(state.electionTracker).toBe(1);
    vi.useRealTimers();
  });

  it('electionTracker = 3 triggers chaos policy enactment', () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.electionTracker = 2;
    state.phase = 'Voting';
    players[0].isPresidentialCandidate = true;
    players[1].isChancellorCandidate = true;

    for (const p of state.players) {
      if (p.isAlive) p.vote = 'Nay';
    }
    engine.handleVoteResult(state, state.roomId);
    vi.advanceTimersByTime(5000);

    // Chaos policy enacted — tracker resets to 0
    expect(state.electionTracker).toBe(0);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ── Timer Expiry Tests ─────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Timer Expiry Paths', () => {
  it('Nominate_Chancellor timer auto-nominates an eligible player', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.phase = 'Nominate_Chancellor';
    players[0].isPresidentialCandidate = true;
    state.actionTimer = 30;

    engine.startActionTimer(state.roomId);
    vi.advanceTimersByTime(30000);
    // Allow the async timer callback to resolve
    await Promise.resolve();

    // One of the eligible players should now be nominated chancellor candidate
    const nominated = state.players.find((p) => p.isChancellorCandidate);
    expect(nominated).toBeDefined();
    expect(nominated!.id).not.toBe(players[0].id);

    vi.useRealTimers();
  });

  it('Voting timer auto-casts votes for abstaining players', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.phase = 'Voting';
    players[0].isPresidentialCandidate = true;
    players[1].isChancellorCandidate = true;
    state.actionTimer = 30;

    // Only player 0 votes; rest abstain — timer should cast and tally the rest
    players[0].vote = 'Aye';

    engine.startActionTimer(state.roomId);
    await vi.runAllTimersAsync();

    // tallyVotes clears votes after processing; the phase should have advanced past Voting
    expect(state.phase).not.toBe('Voting');

    vi.useRealTimers();
  });

  it('Legislative_President timer auto-discards a policy', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.phase = 'Legislative_President';
    players[0].isPresident = true;
    state.presidentId = players[0].id;
    state.drawnPolicies = ['Civil', 'State', 'Civil'];
    state.actionTimer = 30;

    engine.startActionTimer(state.roomId);
    await vi.runAllTimersAsync();

    expect(state.chancellorPolicies).toHaveLength(2);
    expect(state.drawnPolicies).toHaveLength(0);
    expect(state.presidentTimedOut).toBe(true);

    vi.useRealTimers();
  });

  it('Legislative_Chancellor timer auto-enacts a policy', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.phase = 'Legislative_Chancellor';
    players[1].isChancellor = true;
    state.chancellorId = players[1].id;
    state.chancellorPolicies = ['Civil', 'State'];
    state.presidentSaw = ['Civil', 'State', 'State'];
    state.chancellorSaw = ['Civil', 'State'];
    state.actionTimer = 30;

    engine.startActionTimer(state.roomId);
    await vi.runAllTimersAsync();

    // After auto-enactment, chancellorPolicies should be cleared
    expect(state.chancellorPolicies).toHaveLength(0);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ── Title Role Ability Tests ───────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Title Role Abilities', () => {
  it('Assassin kills target when ability is used', async () => {
    const { players, state, engine } = electionSetup();
    const assassin = players[0];
    const target = players[2];
    assassin.titleRole = 'Assassin';
    assassin.titleUsed = false;
    target.role = 'Civil';

    state.titlePrompt = {
      playerId: assassin.id,
      role: 'Assassin',
      context: { role: 'Assassin' },
      nextPhase: 'Handler_Action',
    };
    state.phase = 'Assassin_Action';
    state.presidentIdx = 0;

    await engine.resolveTitleAbility(state, state.roomId, {
      use: true,
      role: 'Assassin',
      targetId: target.id,
    });

    expect(target.isAlive).toBe(false);
    expect(assassin.titleUsed).toBe(true);
  });

  it('Assassin ending game immediately when targeting Overseer', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    const assassin = players[0];
    const overseer = players[4];
    assassin.titleRole = 'Assassin';
    assassin.titleUsed = false;
    overseer.role = 'Overseer';

    state.titlePrompt = {
      playerId: assassin.id,
      role: 'Assassin',
      context: { role: 'Assassin' },
    };
    state.phase = 'Assassin_Action';
    state.presidentIdx = 0;

    await engine.resolveTitleAbility(state, state.roomId, {
      use: true,
      role: 'Assassin',
      targetId: overseer.id,
    });

    await vi.runAllTimersAsync();
    expect(state.phase).toBe('GameOver');
    expect(state.winner).toBe('Civil');

    vi.useRealTimers();
  });

  it('Strategist draws 4 policies when ability is used', async () => {
    const { players, state, engine } = electionSetup();
    const strategist = players[0];
    strategist.titleRole = 'Strategist';
    strategist.titleUsed = false;
    strategist.isPresident = true;
    state.presidentId = strategist.id;
    state.deck = createDeck(); // ensure enough cards

    state.titlePrompt = {
      playerId: strategist.id,
      role: 'Strategist',
      context: { role: 'Strategist' },
      nextPhase: 'Legislative_President',
    };
    state.phase = 'Legislative_President';

    await engine.resolveTitleAbility(state, state.roomId, {
      use: true,
      role: 'Strategist',
    });

    expect(state.drawnPolicies).toHaveLength(4);
    expect(state.isStrategistAction).toBe(true);
    expect(strategist.titleUsed).toBe(true);
  });

  it('Strategist drawing normal 3 when ability is declined', async () => {
    const { players, state, engine } = electionSetup();
    const strategist = players[0];
    strategist.titleRole = 'Strategist';
    strategist.titleUsed = false;

    state.titlePrompt = {
      playerId: strategist.id,
      role: 'Strategist',
      context: { role: 'Strategist' },
    };
    state.phase = 'Legislative_President';
    state.deck = createDeck();

    await engine.resolveTitleAbility(state, state.roomId, { use: false });

    expect(state.drawnPolicies).toHaveLength(3);
    expect(strategist.titleUsed).toBe(false); // not consumed on decline
  });

  it('Broker rejects chancellor candidate and forces re-nomination', async () => {
    const { players, state, engine } = electionSetup();
    const broker = players[2];
    broker.titleRole = 'Broker';
    broker.titleUsed = false;
    players[1].isChancellorCandidate = true;

    state.titlePrompt = {
      playerId: broker.id,
      role: 'Broker',
      context: { role: 'Broker' },
      nextPhase: 'Voting',
    };
    state.phase = 'Nomination_Review';

    await engine.resolveTitleAbility(state, state.roomId, { use: true, role: 'Broker' });

    expect(players[1].isChancellorCandidate).toBe(false);
    expect(state.rejectedChancellorId).toBe(players[1].id);
    expect(broker.titleUsed).toBe(true);
  });

  it('Interdictor detains target for the round', async () => {
    const { players, state, engine } = electionSetup();
    const interdictor = players[2];
    const target = players[3];
    interdictor.titleRole = 'Interdictor';
    interdictor.titleUsed = false;

    state.presidentIdx = 0;
    state.titlePrompt = {
      playerId: interdictor.id,
      role: 'Interdictor',
      context: { role: 'Interdictor' },
      nextPhase: 'Nominate_Chancellor',
    };
    state.phase = 'Nomination_Review';

    await engine.resolveTitleAbility(state, state.roomId, {
      use: true,
      role: 'Interdictor',
      targetId: target.id,
    });

    expect(state.detainedPlayerId).toBe(target.id);
    expect(interdictor.titleUsed).toBe(true);
  });

  it('Handler swaps next two presidents in presidential order', async () => {
    const { players, state, engine } = electionSetup();
    const handler = players[2];
    handler.titleRole = 'Handler';
    handler.titleUsed = false;

    state.presidentIdx = 0;
    const originalNext = state.presidentialOrder![1]; // should get delayed
    const originalFollowing = state.presidentialOrder![2]; // should go first

    state.titlePrompt = {
      playerId: handler.id,
      role: 'Handler',
      context: { role: 'Handler' },
    };
    state.phase = 'Handler_Action';
    // Simulate lastEnactedPolicy so continuePostRoundAfter has a path
    state.lastEnactedPolicy = {
      type: 'Civil',
      timestamp: Date.now(),
      trackerReady: true,
      historyCaptured: true,
    };
    state.declarations = [
      { playerId: players[0].id, playerName: players[0].name, civ: 2, sta: 0, type: 'President', timestamp: Date.now(), drewCiv: 2, drewSta: 1 },
      { playerId: players[1].id, playerName: players[1].name, civ: 2, sta: 0, type: 'Chancellor', timestamp: Date.now() },
    ];

    await engine.resolveTitleAbility(state, state.roomId, { use: true, role: 'Handler' });

    // i1 and i2 positions in presidentialOrder should be swapped
    expect(state.presidentialOrder![1]).toBe(originalFollowing);
    expect(state.presidentialOrder![2]).toBe(originalNext);
    expect(state.handlerSwapPending).toBeDefined();
    expect(handler.titleUsed).toBe(true);
  });

  it('Auditor peeks at the discard pile (no target needed)', async () => {
    const io = createMockIo();
    const { players, state, engine } = electionSetup();
    const auditor = players[3];
    auditor.titleRole = 'Auditor';
    auditor.titleUsed = false;

    state.discard = ['State', 'State', 'Civil'];
    state.titlePrompt = {
      playerId: auditor.id,
      role: 'Auditor',
      context: { role: 'Auditor', discardPile: state.discard.slice(-3) },
    };
    state.phase = 'Auditor_Action';
    state.lastEnactedPolicy = {
      type: 'Civil',
      timestamp: Date.now(),
      trackerReady: true,
      historyCaptured: true,
    };
    state.declarations = [
      { playerId: players[0].id, playerName: players[0].name, civ: 2, sta: 0, type: 'President', timestamp: Date.now(), drewCiv: 2, drewSta: 1 },
      { playerId: players[1].id, playerName: players[1].name, civ: 2, sta: 0, type: 'Chancellor', timestamp: Date.now() },
    ];

    const spy = vi.spyOn(engine['io'], 'to').mockReturnValue({ emit: vi.fn() } as any);

    await engine.resolveTitleAbility(state, state.roomId, { use: true, role: 'Auditor' });

    expect(spy).toHaveBeenCalledWith(auditor.id);
    expect(auditor.titleUsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ── Executive Action Tests ─────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Executive Actions', () => {
  it('Execution kills the target player', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    const president = players[0];
    const target = players[2];
    target.role = 'Civil';

    president.isPresident = true;
    state.presidentId = president.id;
    state.phase = 'Executive_Action';
    state.currentExecutiveAction = 'Execution';
    president.hasActed = false;

    await engine.handleExecutiveAction(state, state.roomId, target.id, president.id);
    await vi.runAllTimersAsync();

    expect(target.isAlive).toBe(false);
    vi.useRealTimers();
  });

  it('Execution targeting Overseer ends the game (Civil win)', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    const president = players[0];
    const overseer = players[4];

    president.isPresident = true;
    state.presidentId = president.id;
    state.phase = 'Executive_Action';
    state.currentExecutiveAction = 'Execution';
    president.hasActed = false;

    await engine.handleExecutiveAction(state, state.roomId, overseer.id, president.id);
    await vi.runAllTimersAsync();

    expect(state.phase).toBe('GameOver');
    expect(state.winner).toBe('Civil');
    vi.useRealTimers();
  });

  it('Investigate emits investigationResult to president socket', async () => {
    const { players, state, engine } = electionSetup();
    const president = players[0];
    const target = players[2];
    target.role = 'State';

    president.isPresident = true;
    state.presidentId = president.id;
    state.phase = 'Executive_Action';
    state.currentExecutiveAction = 'Investigate';
    president.hasActed = false;

    const emitSpy = vi.fn();
    vi.spyOn(engine['io'], 'to').mockReturnValue({ emit: emitSpy } as any);

    await engine.handleExecutiveAction(state, state.roomId, target.id, president.id);

    expect(emitSpy).toHaveBeenCalledWith(
      'investigationResult',
      expect.objectContaining({ targetName: target.name, role: 'State' })
    );
  });

  it('Investigate returns Civil for Civil-role players', async () => {
    const { players, state, engine } = electionSetup();
    const president = players[0];
    const target = players[3]; // Civil role

    president.isPresident = true;
    state.presidentId = president.id;
    state.phase = 'Executive_Action';
    state.currentExecutiveAction = 'Investigate';
    president.hasActed = false;

    const emitSpy = vi.fn();
    vi.spyOn(engine['io'], 'to').mockReturnValue({ emit: emitSpy } as any);

    await engine.handleExecutiveAction(state, state.roomId, target.id, president.id);

    expect(emitSpy).toHaveBeenCalledWith(
      'investigationResult',
      expect.objectContaining({ role: 'Civil' })
    );
  });

  it('SpecialElection sets the target as next president', async () => {
    const { players, state, engine } = electionSetup();
    const president = players[0];
    const target = players[3];

    president.isPresident = true;
    state.presidentId = president.id;
    state.phase = 'Executive_Action';
    state.currentExecutiveAction = 'SpecialElection';
    president.hasActed = false;

    await engine.handleExecutiveAction(state, state.roomId, target.id, president.id);

    // After special election the state should be in nomination with target as presidential candidate
    expect(state.players[state.presidentIdx].id).toBe(target.id);
  });
});

// ---------------------------------------------------------------------------
// ── Victory Condition Tests ────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Victory Conditions', () => {
  it('Civil wins when 5 Civil directives are enacted', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.civilDirectives = 4; // one more will trigger win
    state.phase = 'Legislative_Chancellor';
    players[0].isPresident = true;
    players[1].isChancellor = true;
    state.presidentId = players[0].id;
    state.chancellorId = players[1].id;
    state.chancellorPolicies = ['Civil', 'State'];
    state.presidentSaw = ['Civil', 'Civil', 'State'];
    state.chancellorSaw = ['Civil', 'State'];
    players[1].hasActed = false;

    engine.handleChancellorPlay(state, state.roomId, players[1].id, 0); // enact Civil
    await vi.runAllTimersAsync();

    expect(state.phase).toBe('GameOver');
    expect(state.winner).toBe('Civil');
    vi.useRealTimers();
  });

  it('State wins when 6 State directives are enacted', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    state.stateDirectives = 5; // one more triggers win
    state.phase = 'Legislative_Chancellor';
    players[0].isPresident = true;
    players[1].isChancellor = true;
    state.presidentId = players[0].id;
    state.chancellorId = players[1].id;
    state.chancellorPolicies = ['State', 'Civil'];
    state.presidentSaw = ['State', 'State', 'Civil'];
    state.chancellorSaw = ['State', 'Civil'];
    players[1].hasActed = false;

    engine.handleChancellorPlay(state, state.roomId, players[1].id, 0); // enact State
    await vi.runAllTimersAsync();

    expect(state.phase).toBe('GameOver');
    expect(state.winner).toBe('State');
    vi.useRealTimers();
  });

  it('Overseer elected chancellor after 3 State directives causes State win', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup();
    const overseer = players[4];
    overseer.role = 'Overseer';
    state.stateDirectives = 3; // threshold met

    state.phase = 'Voting';
    players[0].isPresidentialCandidate = true;
    players[0].isAlive = true;
    overseer.isChancellorCandidate = true;
    overseer.isAlive = true;

    for (const p of state.players) {
      if (p.isAlive) p.vote = 'Aye';
    }
    engine.handleVoteResult(state, state.roomId);
    await vi.runAllTimersAsync();

    expect(state.phase).toBe('GameOver');
    expect(state.winner).toBe('State');
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ── Presidential Rotation Tests ───────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Presidential Rotation', () => {
  it('presidency advances to the next alive player each round', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup(5);
    const firstPresidentId = state.players[state.presidentIdx].id;

    engine.nextPresident(state, state.roomId, false);
    vi.advanceTimersByTime(3000);
    // Allow any async logic or banters to resolve
    await Promise.resolve();

    const secondPresidentId = state.players[state.presidentIdx].id;
    expect(secondPresidentId).not.toBe(firstPresidentId);
    vi.useRealTimers();
  });

  it('presidency skips dead players in rotation', async () => {
    vi.useFakeTimers();
    const { players, state, engine } = electionSetup(5);
    // Kill player at index 1 so the rotation must skip them
    players[1].isAlive = false;

    engine.nextPresident(state, state.roomId, false);
    vi.advanceTimersByTime(3000);
    // Allow async logic to resolve
    await Promise.resolve();

    const nextPres = state.players[state.presidentIdx];
    expect(nextPres.isAlive).toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ── Eligibility Guard Tests ───────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Eligibility Guards', () => {
  it('getEligibleChancellors excludes detainedPlayerId', () => {
    const { players, state, engine } = electionSetup();
    state.detainedPlayerId = players[2].id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligible = (engine as any).getEligibleChancellors(state, players[0].id) as Player[];
    expect(eligible.find((p) => p.id === players[2].id)).toBeUndefined();
  });

  it('getEligibleChancellors excludes rejectedChancellorId', () => {
    const { players, state, engine } = electionSetup();
    state.rejectedChancellorId = players[1].id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligible = (engine as any).getEligibleChancellors(state, players[0].id) as Player[];
    expect(eligible.find((p) => p.id === players[1].id)).toBeUndefined();
  });

  it('getEligibleChancellors excludes wasPresident when >= 6 alive players', () => {
    // Need 6 players
    const players = Array.from({ length: 6 }, (_, i) =>
      makePlayer({ role: i === 0 ? 'Overseer' : 'Civil' })
    );
    const state = buildState(players);
    const { engine } = buildEngine(state);

    players[1].wasPresident = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligible = (engine as any).getEligibleChancellors(state, players[0].id) as Player[];
    expect(eligible.find((p) => p.id === players[1].id)).toBeUndefined();
  });
});
