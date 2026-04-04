import { GameState, EventCardId, EventCardType } from '../../shared/types';

export interface EventCardDef {
  id: EventCardId;
  name: string;
  description: string; // shown to all players when the card is drawn
  icon: string;        // lucide-react icon name
  type: EventCardType;
  canDraw: (s: GameState) => boolean; // return false to skip this card
}

export const EVENT_CARD_DEFS: EventCardDef[] = [
  {
    id: 'state_of_emergency',
    name: 'State of Emergency',
    description: 'The election tracker cannot advance this round.',
    icon: 'Lock',
    type: 'RoundDuration',
    canDraw: () => true,
  },
  {
    id: 'open_session',
    name: 'Open Session',
    description: 'Votes are revealed in real-time as each player casts them.',
    icon: 'Megaphone',
    type: 'RoundDuration',
    canDraw: () => true,
  },
  {
    id: 'veiled_proceedings',
    name: 'Veiled Proceedings',
    description: "The President cannot make a declaration this round. Only the Chancellor speaks.",
    icon: 'Mask',
    type: 'RoundDuration',
    canDraw: () => true,
  },
  {
    id: 'censure_motion',
    name: 'Censure Motion',
    description: 'Players vote on who to censure. The plurality result cannot be Chancellor this round.',
    icon: 'Scale',
    type: 'RoundDuration',
    canDraw: () => true,
  },
  {
    id: 'dead_mans_gambit',
    name: "Dead Man's Gambit",
    description: 'One eliminated player casts a secret ghost vote in this round\'s election.',
    icon: 'Skull',
    type: 'RoundDuration',
    canDraw: (s) => s.players.some((p) => !p.isAlive),
  },
  {
    id: 'snap_election',
    name: 'Snap Election',
    description: 'Any player may volunteer to be President this round within 10 seconds.',
    icon: 'Zap',
    type: 'Immediate',
    canDraw: () => true,
  },
  {
    id: 'double_or_nothing',
    name: 'Double or Nothing',
    description: 'If the government fails, the election tracker advances by 2 instead of 1.',
    icon: 'Flame',
    type: 'RoundDuration',
    canDraw: (s) => s.electionTracker <= 1,
  },
  {
    id: 'iron_mandate',
    name: 'Iron Mandate',
    description: 'Any policy enacted this round counts as 2 directives on its track.',
    icon: 'Scroll',
    type: 'RoundDuration',
    canDraw: () => true,
  },
  {
    id: 'blackout',
    name: 'Blackout',
    description: 'Chat is hidden from all other players this round. Messages are revealed at round end.',
    icon: 'Moon',
    type: 'RoundDuration',
    canDraw: () => true,
  },
];
