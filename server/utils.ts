import { Policy } from "../src/types.ts";

export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function createDeck(): Policy[] {
  const deck: Policy[] = [];
  for (let i = 0; i < 6; i++) deck.push("Civil");
  for (let i = 0; i < 11; i++) deck.push("State");
  return shuffle(deck);
}
