// ---------------------------------------------------------------------------
// Server-side achievement evaluator
// ---------------------------------------------------------------------------
import { ACHIEVEMENT_DEFS } from "../src/lib/achievements.ts";
import type { GameState, Player, UserInternal } from "../src/types";

export interface AchievementContext {
  /** User record AFTER stats have been incremented for this game */
  user: UserInternal;
  /** Full game state */
  s: GameState;
  /** This player's game-level record */
  p: Player;
  /** Whether this player won */
  won: boolean;
  /** Whether this player's personal agenda was completed */
  agendaCompleted: boolean;
}

/**
 * Checks all achievements against the post-game context and returns the IDs
 * of any achievements newly earned this game.
 * Already-earned achievements are skipped.
 */
export function checkAchievements(ctx: AchievementContext): string[] {
  const { user, s, p, won, agendaCompleted } = ctx;

  const earned: string[] = (user.earnedAchievements ?? []).map((a: { id: string }) =>
    typeof a === 'string' ? a : a.id
  );
  const alreadyEarned = new Set<string>(earned);

  const newlyEarned: string[] = [];

  const grant = (id: string) => {
    if (!alreadyEarned.has(id)) {
      newlyEarned.push(id);
      alreadyEarned.add(id); // prevent double-grant within same evaluation
    }
  };

  const stats = user.stats;

  // ── Milestone ──────────────────────────────────────────────────────────
  if (stats.gamesPlayed >= 1) grant('first_assembly');
  if (stats.gamesPlayed >= 25) grant('veteran');
  if (stats.gamesPlayed >= 100) grant('elder');

  if (stats.wins >= 1) grant('first_victory');
  if (stats.wins >= 10) grant('ten_wins');
  if (stats.wins >= 50) grant('fifty_wins');

  // ── Role ───────────────────────────────────────────────────────────────
  if (stats.civilWins >= 1) grant('civil_first_win');
  if (stats.civilWins >= 10) grant('civil_ten_wins');
  if (stats.civilWins >= 20) grant('civil_twenty_wins');

  if (stats.stateWins >= 1) grant('state_first_win');
  if (stats.stateWins >= 10) grant('state_ten_wins');
  if (stats.stateWins >= 20) grant('state_twenty_wins');

  if (p.role === 'Overseer') grant('overseer_played');
  if (p.role === 'Overseer' && won) grant('overseer_win');

  // ── Title Role ─────────────────────────────────────────────────────────
  // power_used: this player used their title ability this game
  if (p.titleRole && p.titleUsed) grant('power_used');

  // assassins_mark: Assassin killed someone (they used their ability and game
  // still had living players — if they killed the Overseer the game ends).
  if (
    p.titleRole === 'Assassin' &&
    p.titleUsed &&
    (s.winReason === 'OVERSEER ASSASSINATED' || s.players.some(pl => !pl.isAlive && !pl.isAI))
  ) {
    grant('assassins_mark');
  }

  // overseer_hunter: Assassin specifically killed the Overseer
  if (
    p.titleRole === 'Assassin' &&
    p.titleUsed &&
    s.winReason === 'OVERSEER ASSASSINATED' &&
    won // Civil wins when Overseer is assassinated
  ) {
    grant('overseer_hunter');
  }

  // ── Gameplay ───────────────────────────────────────────────────────────
  if (agendaCompleted) grant('agenda_first');
  if (stats.agendasCompleted >= 10) grant('agenda_ten');
  if (stats.agendasCompleted >= 25) grant('agenda_twentyfive');

  if (stats.kills >= 1) grant('first_kill');
  if (stats.kills >= 5) grant('five_kills');

  // clean_sweep: won and zero State directives the whole game
  if (won && s.stateDirectives === 0) grant('clean_sweep');

  // long_game: game reached round 12
  if (s.round >= 12) grant('long_game');

  // landslide: any round in this game had unanimous Aye votes
  if (s.roundHistory?.some(r =>
    !r.failed &&
    r.votes.length > 0 &&
    r.votes.every(v => v.vote === 'Aye')
  )) {
    grant('landslide');
  }

  return newlyEarned;
}
