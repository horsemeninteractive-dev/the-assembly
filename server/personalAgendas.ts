/**
 * personalAgendas.ts — Personal Agenda system for The Assembly
 *
 * Each player is assigned one hidden agenda at game start.
 * Completing it awards XP equal to a faction win + bonus cabinetPoints.
 * Status is evaluated at game end from GameState alone.
 */

import { GameState, PersonalAgendaId, AgendaStatus, PersonalAgenda } from "../src/types.ts";
import { shuffle } from "./utils.ts";

// ---------------------------------------------------------------------------
// Agenda catalogue
// ---------------------------------------------------------------------------

export interface AgendaDefinition {
  id: PersonalAgendaId;
  name: string;
  description: string;
  evaluate: (state: GameState, playerId: string) => AgendaStatus;
}

export const AGENDA_DEFINITIONS: AgendaDefinition[] = [
  {
    id: "chaos_agent",
    name: "Chaos Agent",
    description: "The election tracker must hit 3 and trigger a chaos policy at least once.",
    evaluate: (s, _pid) => {
      const fired = s.roundHistory?.some(r => r.chaos) ?? false;
      if (fired) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_purist",
    name: "The Purist",
    description: "At least 3 Civil directives must be enacted by the time the game ends.",
    evaluate: (s, _pid) => {
      if (s.civilDirectives >= 3) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_dissenter",
    name: "The Dissenter",
    description: "Your vote must differ from the majority outcome in at least 3 rounds.",
    evaluate: (s, pid) => {
      let count = 0;
      for (const r of s.roundHistory ?? []) {
        if (r.failed || r.chaos) continue; // only check voting rounds
        const myEntry = r.votes.find(v => v.playerId === pid);
        if (!myEntry) continue;
        const ayes = r.votes.filter(v => v.vote === "Aye").length;
        const nays = r.votes.filter(v => v.vote === "Nay").length;
        const majority = ayes > nays ? "Aye" : "Nay";
        if (myEntry.vote !== majority) count++;
      }
      // Also count failed elections where they voted against majority
      for (const r of s.roundHistory ?? []) {
        if (!r.failed || r.chaos) continue;
        const myEntry = r.votes.find(v => v.playerId === pid);
        if (!myEntry) continue;
        const ayes = r.votes.filter(v => v.vote === "Aye").length;
        const nays = r.votes.filter(v => v.vote === "Nay").length;
        if (ayes === 0 && nays === 0) continue;
        const majority = ayes > nays ? "Aye" : "Nay";
        if (myEntry.vote !== majority) count++;
      }
      if (count >= 3) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_dove",
    name: "The Dove",
    description: "Vote Aye in every round you cast a vote.",
    evaluate: (s, pid) => {
      let votedAny = false;
      for (const r of s.roundHistory ?? []) {
        if (r.chaos) continue;
        const myEntry = r.votes.find(v => v.playerId === pid);
        if (!myEntry) continue; // detained or dead — skip
        votedAny = true;
        if (myEntry.vote !== "Aye") return "failed";
      }
      
      if (s.phase === "GameOver") {
        return votedAny ? "completed" : "failed";
      }
      return "unresolved";
    },
  },

  {
    id: "the_hawk",
    name: "The Hawk",
    description: "Vote Nay in at least 3 rounds.",
    evaluate: (s, pid) => {
      const count = (s.roundHistory ?? []).filter(r =>
        !r.chaos && r.votes.some(v => v.playerId === pid && v.vote === "Nay")
      ).length;
      if (count >= 3) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "stonewalled",
    name: "Stonewalled",
    description: "Vote Nay on at least 2 governments that then fail.",
    evaluate: (s, pid) => {
      const count = (s.roundHistory ?? []).filter(r =>
        r.failed && !r.chaos &&
        r.votes.some(v => v.playerId === pid && v.vote === "Nay")
      ).length;
      if (count >= 2) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "short_session",
    name: "Short Session",
    description: "The game must end before round (player count + 3).",
    evaluate: (s, _pid) => {
      const threshold = s.players.length + 3;
      if (s.round >= threshold) return "failed";
      return s.phase === "GameOver" ? "completed" : "unresolved";
    },
  },

  {
    id: "the_long_game",
    name: "The Long Game",
    description: "The game must last at least (player count + 6) rounds.",
    evaluate: (s, _pid) => {
      const threshold = s.players.length + 6;
      if (s.round >= threshold) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_loyalist",
    name: "The Loyalist",
    description: "Vote Aye on at least 3 governments that pass and enact a Civil directive.",
    evaluate: (s, pid) => {
      const count = (s.roundHistory ?? []).filter(r =>
        !r.failed && !r.chaos &&
        r.policy === "Civil" &&
        r.votes.some(v => v.playerId === pid && v.vote === "Aye")
      ).length;
      if (count >= 3) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "nominated",
    name: "Nominated",
    description: "Be nominated as Chancellor at least 2 times.",
    evaluate: (s, pid) => {
      const count = (s.roundHistory ?? []).filter(r =>
        !r.chaos && r.chancellorId === pid
      ).length;
      if (count >= 2) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "deadlock",
    name: "Deadlock",
    description: "Be President or Chancellor candidate in at least 1 failed government.",
    evaluate: (s, pid) => {
      const found = (s.roundHistory ?? []).some(r =>
        r.failed && !r.chaos &&
        (r.presidentId === pid || r.chancellorId === pid)
      );
      if (found) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "prolific",
    name: "Prolific",
    description: "Personally enact at least 2 policies as Chancellor.",
    evaluate: (s, pid) => {
      const player = s.players.find(p => p.id === pid);
      const enacted = (player?.stateEnactments ?? 0) + (player?.civilEnactments ?? 0);
      if (enacted >= 2) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_veteran",
    name: "The Veteran",
    description: "Serve as Chancellor at least once.",
    evaluate: (s, pid) => {
      const served = (s.roundHistory ?? []).some(r =>
        !r.failed && !r.chaos && r.chancellorId === pid
      );
      if (served) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "unity",
    name: "Unity",
    description: "No chaos policy is enacted at any point during the game.",
    evaluate: (s, _pid) => {
      const chaosFired = s.roundHistory?.some(r => r.chaos) ?? false;
      if (chaosFired) return "failed";
      return s.phase === "GameOver" ? "completed" : "unresolved";
    },
  },

  {
    id: "the_mandate",
    name: "The Mandate",
    description: "At least 4 State directives must be enacted by the time the game ends.",
    evaluate: (s, _pid) => {
      if (s.stateDirectives >= 4) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "clean_sweep",
    name: "Clean Sweep",
    description: "Enact a Civil directive as Chancellor.",
    evaluate: (s, pid) => {
      const player = s.players.find(p => p.id === pid);
      if ((player?.civilEnactments ?? 0) >= 1) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "the_weathervane",
    name: "The Weathervane",
    description: "Switch your vote relative to your previous round's vote at least 4 times.",
    evaluate: (s, pid) => {
      // Build ordered list of votes this player cast
      const votes = (s.roundHistory ?? [])
        .filter(r => !r.chaos)
        .sort((a, b) => a.round - b.round)
        .map(r => r.votes.find(v => v.playerId === pid)?.vote)
        .filter((v): v is "Aye" | "Nay" => v !== undefined);

      let switches = 0;
      for (let i = 1; i < votes.length; i++) {
        if (votes[i] !== votes[i - 1]) switches++;
      }
      if (switches >= 4) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },

  {
    id: "productive_session",
    name: "Productive Session",
    description: "More than half of all rounds must result in a policy being successfully enacted.",
    evaluate: (s, _pid) => {
      const history = s.roundHistory ?? [];
      if (history.length === 0) return "unresolved";
      const productive = history.filter(r => !r.failed && !r.chaos).length;
      if (s.phase === "GameOver") {
        return productive > history.length / 2 ? "completed" : "failed";
      }
      return "unresolved";
    },
  },

  {
    id: "close_race",
    name: "Close Race",
    description: "The game must end with both policy tracks within 2 directives of each other.",
    evaluate: (s, _pid) => {
      const diff = Math.abs(s.civilDirectives - s.stateDirectives);
      if (s.phase === "GameOver") {
        return diff <= 2 ? "completed" : "failed";
      }
      return "unresolved";
    },
  },

  {
    id: "the_swing_vote",
    name: "The Swing Vote",
    description: "Be President or Chancellor in a government that passes by exactly 1 vote.",
    evaluate: (s, pid) => {
      const found = (s.roundHistory ?? []).some(r => {
        if (r.failed || r.chaos) return false;
        if (r.presidentId !== pid && r.chancellorId !== pid) return false;
        const ayes = r.votes.filter(v => v.vote === "Aye").length;
        const nays = r.votes.filter(v => v.vote === "Nay").length;
        return (ayes - nays) === 1;
      });
      if (found) return "completed";
      return s.phase === "GameOver" ? "failed" : "unresolved";
    },
  },
];

// Map for quick lookup
export const AGENDA_MAP = new Map<PersonalAgendaId, AgendaDefinition>(
  AGENDA_DEFINITIONS.map(a => [a.id, a])
);

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * Assign one unique personal agenda to each player at game start.
 * AIs get agendas too (for future use) but their status is not surfaced.
 */
export function assignPersonalAgendas(state: GameState): void {
  const ids = shuffle([...AGENDA_DEFINITIONS.map(a => a.id)]);
  state.players.forEach((p, i) => {
    p.personalAgenda = ids[i % ids.length] as PersonalAgendaId;
  });
}

// ---------------------------------------------------------------------------
// Evaluation at game end
// ---------------------------------------------------------------------------

/**
 * Evaluate every human player's personal agenda and return a map
 * of playerId -> AgendaStatus. Called inside updateUserStats.
 */
export function evaluateAllAgendas(
  state: GameState
): Map<string, AgendaStatus> {
  const results = new Map<string, AgendaStatus>();
  for (const p of state.players) {
    if (!p.personalAgenda) continue;
    const def = AGENDA_MAP.get(p.personalAgenda);
    if (!def) continue;
    results.set(p.id, def.evaluate(state, p.id));
  }
  return results;
}

/**
 * Build a PersonalAgenda object for a player to send via privateInfo.
 * Status is evaluated live so the dossier always shows current state.
 */
export function getPlayerAgenda(
  state: GameState,
  playerId: string
): PersonalAgenda | undefined {
  const player = state.players.find(p => p.id === playerId);
  if (!player?.personalAgenda) return undefined;
  const def = AGENDA_MAP.get(player.personalAgenda);
  if (!def) return undefined;

  const status = def.evaluate(state, playerId);

  return { id: def.id, name: def.name, description: def.description, status };
}
