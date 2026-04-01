/**
 * server/gameEngine.ts — Re-export shim
 *
 * All business logic has been moved to server/engine/.
 * This file exists purely so that external importers
 * (server.ts, handlers, routes) do not need to change their import paths.
 *
 * Import map:
 *   GameEngine      ← server/engine/GameEngine.ts  (thin orchestrator)
 *   Deps            ← server/engine/GameEngine.ts
 *   computeEloChange← server/engine/utils.ts
 */

export { GameEngine } from './engine/GameEngine';
export type { Deps } from './engine/GameEngine';
export { computeEloChange } from './engine/utils';

