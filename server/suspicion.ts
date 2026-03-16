import { GameState, Player, Policy } from "../src/types.ts";

// =============================================================================
// BAYESIAN SUSPICION MODEL
// Each AI maintains a per-player belief about whether that player is State/Overseer,
// stored as log-odds so evidence compounds correctly via addition.
//
// Evidence sources:
//   1. Government voting outcomes (who voted Aye for a State-directive government)
//   2. Policy declarations (president/chancellor claims about what they saw)
//   3. Declaration inconsistency (president vs chancellor claims)
//   4. State enactment count (chancellor repeatedly passing State directives)
//   5. Investigation results (direct, strong evidence)
//   6. Chancellor nomination choices (State presidents nominate State chancellors)
// =============================================================================

function logOdds(p: number): number {
  p = Math.max(0.01, Math.min(0.99, p));
  return Math.log(p / (1 - p));
}

function fromLogOdds(lo: number): number {
  return 1 / (1 + Math.exp(-lo));
}

function clampLO(lo: number): number {
  return Math.max(logOdds(0.02), Math.min(logOdds(0.98), lo));
}

/**
 * Initialise suspicion scores for every AI at game-start.
 * Civil players start at the uninformed prior (numState / numPlayers).
 * State agents already have perfect team knowledge, so they start near-certain.
 */
export function initializeSuspicion(state: GameState): void {
  const n = state.players.length;
  const numState = n <= 6 ? 2 : n <= 8 ? 3 : 4; // includes Overseer
  const prior = numState / n;

  for (const ai of state.players.filter(p => p.isAI)) {
    ai.suspicion = {};
    ai.stateEnactments = 0;
    for (const target of state.players) {
      if (target.id === ai.id) continue;
      if (ai.role === "Civil") {
        ai.suspicion[target.id] = logOdds(prior);
      } else {
        // State / Overseer know everyone's alignment
        const isStateTeam = target.role === "State" || target.role === "Overseer";
        ai.suspicion[target.id] = logOdds(isStateTeam ? 0.97 : 0.03);
      }
    }
  }
}

export function getSuspicion(ai: Player, targetId: string): number {
  if (!ai.suspicion || ai.suspicion[targetId] === undefined) return 0.4;
  return fromLogOdds(ai.suspicion[targetId]);
}

function nudge(ai: Player, targetId: string, lr: number): void {
  if (!ai.suspicion || ai.suspicion[targetId] === undefined || targetId === ai.id) return;
  ai.suspicion[targetId] = clampLO(ai.suspicion[targetId] + Math.log(lr));
}

/**
 * After a policy is enacted by a successful government, update every Civil AI's
 * beliefs based on who voted for this government and who was President/Chancellor.
 */
export function updateSuspicionFromPolicy(state: GameState, policy: Policy): void {
  const votes = state.lastGovernmentVotes;
  const presId = state.lastGovernmentPresidentId;
  const chanId = state.lastGovernmentChancellorId;
  if (!votes) return;

  for (const ai of state.players.filter(p => p.isAI && p.role === "Civil")) {
    if (!ai.suspicion) continue;

    // Voting evidence: P(Aye|State)/P(Aye|Civil)
    for (const [pid, v] of Object.entries(votes)) {
      if (pid === ai.id) continue;
      if (policy === "State") {
        nudge(ai, pid, v === "Aye" ? 1.78 : 0.56);
      } else {
        nudge(ai, pid, v === "Aye" ? 0.71 : 1.40);
      }
    }

    // Government members are stronger signals than plain votes
    // Chancellor blame model: Chancellor gets more blame/credit than President
    if (presId && presId !== ai.id) {
      nudge(ai, presId, policy === "State" ? 1.5 : 0.70);
    }
    if (chanId && chanId !== ai.id) {
      nudge(ai, chanId, policy === "State" ? 3.5 : 0.40);
      const chan = state.players.find(p => p.id === chanId);
      if (chan && policy === "State") {
        chan.stateEnactments = (chan.stateEnactments ?? 0) + 1;
      }
    }
  }
}

export function updateSuspicionFromPolicyExpectation(state: GameState, policy: Policy): void {
  const presDecl = state.declarations.find(d => d.type === "President");
  if (!presDecl || presDecl.drewSta === undefined) return;

  // Policy Expectation Signal: President plays state policy when civil likely
  const expectedStateProb = presDecl.drewSta / 3;
  const actualOutcome = policy === "State" ? 1 : 0;
  
  // If President drew 3 Civil, playing State is highly suspicious
  if (presDecl.drewSta === 0 && policy === "State") {
    for (const ai of state.players.filter(p => p.isAI && p.role === "Civil")) {
      if (presDecl.playerId !== ai.id) nudge(ai, presDecl.playerId, 5.0);
    }
  }
}

/**
 * After both President and Chancellor have declared what they saw/passed,
 * check for logical impossibilities and update beliefs accordingly.
 *
 * President draws 3, discards 1, passes 2 to chancellor.
 * Consistent iff: chanDecl.sta <= presDecl.sta  AND  presDecl.sta - chanDecl.sta <= 1
 */
export function updateSuspicionFromDeclarations(state: GameState): void {
  const presDecl = state.declarations.find(d => d.type === "President");
  const chanDecl = state.declarations.find(d => d.type === "Chancellor");
  if (!presDecl || !chanDecl) return;

  const gap = presDecl.sta - chanDecl.sta;
  const inconsistent = chanDecl.sta > presDecl.sta || gap > 1;

  for (const ai of state.players.filter(p => p.isAI && p.role === "Civil")) {
    if (!ai.suspicion) continue;

    if (inconsistent) {
      // Definite lie — raise both by LR ≈ 2.0
      if (presDecl.playerId !== ai.id) nudge(ai, presDecl.playerId, 2.0);
      if (chanDecl.playerId !== ai.id) nudge(ai, chanDecl.playerId, 2.0);
      state.log.push(`[Suspicion] Inconsistent declarations: ${presDecl.playerName} vs ${chanDecl.playerName}.`);
    } else {
      // Consistent — modest trust boost
      if (presDecl.playerId !== ai.id) nudge(ai, presDecl.playerId, 0.82);
      if (chanDecl.playerId !== ai.id) nudge(ai, chanDecl.playerId, 0.82);
    }

    // "All 3 were State" is a common State deflection
    if (presDecl.sta === 3 && presDecl.playerId !== ai.id) nudge(ai, presDecl.playerId, 1.2);

    // Chancellor claiming 2-State hand is exculpatory for them but pins president
    if (chanDecl.sta === 2 && presDecl.sta >= 2 && presDecl.playerId !== ai.id) {
      nudge(ai, presDecl.playerId, 1.3);
    }
  }
}

export function updateSuspicionFromInvestigation(
  state: GameState,
  investigatorId: string,
  targetId: string,
  result: "Civil" | "State"
): void {
  for (const ai of state.players.filter(p => p.isAI && p.role === "Civil")) {
    if (!ai.suspicion) continue;
    if (targetId !== ai.id) nudge(ai, targetId, result === "State" ? 10.0 : 0.08);
    if (investigatorId !== ai.id) nudge(ai, investigatorId, result === "State" ? 0.85 : 0.88);
  }
}

/**
 * When a president nominates a chancellor, observing Civil AIs note who was chosen.
 * Nominating an already-suspicious player increases suspicion of the president.
 */
export function updateSuspicionFromNomination(
  state: GameState,
  presidentId: string,
  chancellorId: string
): void {
  for (const ai of state.players.filter(p => p.isAI && p.role === "Civil")) {
    if (!ai.suspicion) continue;
    const chanSusp = getSuspicion(ai, chancellorId);
    if (chanSusp > 0.60 && presidentId !== ai.id) {
      nudge(ai, presidentId, 1.0 + chanSusp);
    }
    if (chancellorId !== ai.id) {
      nudge(ai, chancellorId, chanSusp > 0.55 ? 1.2 : 0.95);
    }
  }
}

export function leastSuspicious(ai: Player, candidates: Player[]): Player {
  return candidates.reduce((best, p) =>
    getSuspicion(ai, p.id) < getSuspicion(ai, best.id) ? p : best
  );
}

export function mostSuspicious(ai: Player, candidates: Player[]): Player {
  return candidates.reduce((most, p) =>
    getSuspicion(ai, p.id) > getSuspicion(ai, most.id) ? p : most
  );
}
