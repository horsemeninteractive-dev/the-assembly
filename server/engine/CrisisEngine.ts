import { GameState, EventCardId } from '../../shared/types';
import { EVENT_CARD_DEFS, EventCardDef } from '../game/eventCards';
import { shuffle } from '../utils';
import { addLog } from './utils';
import type { IEngineCore } from './IEngineCore';

export class CrisisEngine {
  // Store decks per room to allow concurrent games
  private roomDecks: Map<string, EventCardDef[]> = new Map();

  constructor(private readonly engine: IEngineCore) {}

  /** Called at game start to initialise the deck for a specific room. */
  initDeck(roomId: string): void {
    this.roomDecks.set(roomId, shuffle([...EVENT_CARD_DEFS]));
  }

  /** Draw the next valid card. Skips cards whose canDraw() returns false. Reshuffles if exhausted. */
  drawEventCard(s: GameState, roomId: string): void {
    let deck = this.roomDecks.get(roomId);
    if (!deck || deck.length === 0) {
      deck = shuffle([...EVENT_CARD_DEFS]);
      this.roomDecks.set(roomId, deck);
    }

    let card: EventCardDef | undefined;
    const tried = new Set<string>();

    while (deck.length > 0) {
      const candidate = deck.shift()!;
      if (candidate.canDraw(s)) {
        card = candidate;
        break;
      }
      tried.add(candidate.id);
      deck.push(candidate); // cycle to back
      if (tried.size >= EVENT_CARD_DEFS.length) break; // all cards invalid — skip round
    }

    if (!card) return; // no valid card this round

    s.activeEventCard = { id: card.id, name: card.name, description: card.description, icon: card.icon, type: card.type };
    if (!s.eventCardLog) s.eventCardLog = [];
    s.eventCardLog.push(card.id);

    this.applyCardFlags(s, card.id);
    addLog(s, `[CRISIS] ${card.name}: ${card.description}`);
    this.engine.io.to(roomId).emit('eventCardDrawn', s.activeEventCard);
  }

  /** Apply the GameState flags for the given card. */
  private applyCardFlags(s: GameState, id: string): void {
    switch (id) {
      case 'state_of_emergency':
        s.electionTrackerFrozen = true;
        break;
      case 'open_session':
        s.openSession = true;
        break;
      case 'veiled_proceedings':
        s.presidentDeclarationBlocked = true;
        break;
      case 'censure_motion':
        s.censureMotionActive = true;
        break;
      case 'dead_mans_gambit': {
        const dead = s.players.filter((p) => !p.isAlive);
        if (dead.length > 0) {
          const ghost = dead[Math.floor(Math.random() * dead.length)];
          s.ghostVoterId = ghost.id;
        }
        break;
      }
      case 'snap_election':
        s.snapElectionActive = true;
        break;
      case 'double_or_nothing':
        s.doubleTrackerOnFail = true;
        break;
      case 'iron_mandate':
        s.ironMandate = true;
        break;
      case 'blackout':
        s.chatBlackout = true;
        s.chatBlackoutBuffer = [];
        break;
    }
  }

  /** Clear all event card flags. Called at the start of nextRound before drawing a new card. */
  clearEventCard(s: GameState): void {
    if (s.chatBlackout && s.chatBlackoutBuffer && s.chatBlackoutBuffer.length > 0) {
      if (!s.messages) s.messages = [];
      s.messages.push({
        sender: 'SYSTEM',
        text: '--- Blackout Over: Messages Restored ---',
        timestamp: Date.now(),
        type: 'system',
      });
      s.chatBlackoutBuffer.forEach((msg) => {
        s.messages!.push({
          sender: msg.senderName,
          text: msg.text,
          timestamp: msg.timestamp,
        });
      });
    }

    s.activeEventCard = undefined;
    s.electionTrackerFrozen = undefined;
    s.openSession = undefined;
    s.presidentDeclarationBlocked = undefined;
    s.censureMotionActive = undefined;
    s.censuredPlayerId = undefined;
    s.ghostVoterId = undefined;
    s.snapElectionActive = undefined;
    s.doubleTrackerOnFail = undefined;
    s.ironMandate = undefined;
    s.chatBlackout = undefined;
    s.chatBlackoutBuffer = undefined;
  }

  cleanup(roomId: string): void {
    this.roomDecks.delete(roomId);
  }
}
