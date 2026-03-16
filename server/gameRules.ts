import { ExecutiveAction, GameState, Role } from "../src/types.ts";
import { shuffle } from "./utils.ts";

/**
 * Returns the executive action triggered after the nth State directive is enacted,
 * based on player count. Returns "None" if no action is triggered.
 */
export function getExecutiveAction(state: GameState): ExecutiveAction {
  const n = state.players.length;
  const f = state.stateDirectives;

  if (n <= 6) {
    if (f === 3) return "PolicyPeek";
    if (f === 4) return "Execution";
    if (f === 5) return "Execution";
  } else if (n <= 8) {
    if (f === 2) return "Investigate";
    if (f === 3) return "SpecialElection";
    if (f === 4) return "Execution";
    if (f === 5) return "Execution";
  } else {
    if (f === 1) return "Investigate";
    if (f === 2) return "Investigate";
    if (f === 3) return "SpecialElection";
    if (f === 4) return "Execution";
    if (f === 5) return "Execution";
  }
  return "None";
}

/**
 * Returns a shuffled role array for the given player count.
 */
export function assignRoles(numPlayers: number): Role[] {
  const roleMap: Record<number, Role[]> = {
    5:  ["Civil", "Civil", "Civil", "State", "Overseer"],
    6:  ["Civil", "Civil", "Civil", "Civil", "State", "Overseer"],
    7:  ["Civil", "Civil", "Civil", "Civil", "State", "State", "Overseer"],
    8:  ["Civil", "Civil", "Civil", "Civil", "Civil", "State", "State", "Overseer"],
    9:  ["Civil", "Civil", "Civil", "Civil", "Civil", "State", "State", "State", "Overseer"],
    10: ["Civil", "Civil", "Civil", "Civil", "Civil", "Civil", "State", "State", "State", "Overseer"],
  };
  return shuffle(roleMap[numPlayers] ?? []);
}
