import { describe, it, expect } from 'vitest';
import { AGENDA_MAP } from '../game/personalAgendas';
import { GameState } from '../../shared/types';

describe('Personal Agendas Evaluation', () => {
  const pid = 'p1';

  describe('Chaos Agent', () => {
    const agenda = AGENDA_MAP.get('chaos_agent')!;

    it('returns completed if any round had chaos', () => {
      const state = {
        roundHistory: [{ chaos: true }],
        phase: 'Nominate_Chancellor',
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });

    it('returns unresolved if no chaos and game not over', () => {
      const state = {
        roundHistory: [{ chaos: false }],
        phase: 'Nominate_Chancellor',
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('unresolved');
    });

    it('returns failed if no chaos and game is over', () => {
      const state = {
        roundHistory: [{ chaos: false }],
        phase: 'GameOver',
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('failed');
    });
  });

  describe('The Purist', () => {
    const agenda = AGENDA_MAP.get('the_purist')!;

    it('returns completed if 3+ civil directives enacted', () => {
      const state = { civilDirectives: 3 } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });

    it('returns failed if less than 3 and game over', () => {
      const state = { civilDirectives: 2, phase: 'GameOver' } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('failed');
    });
  });

  describe('The Dissenter', () => {
    const agenda = AGENDA_MAP.get('the_dissenter')!;

    it('returns completed if voted against majority in 3 rounds', () => {
      const state = {
        roundHistory: [
          {
            failed: false,
            chaos: false,
            votes: [
              { playerId: pid, vote: 'Nay' },
              { playerId: 'p2', vote: 'Aye' },
              { playerId: 'p3', vote: 'Aye' },
            ],
          },
          {
            failed: false,
            chaos: false,
            votes: [
              { playerId: pid, vote: 'Aye' },
              { playerId: 'p2', vote: 'Nay' },
              { playerId: 'p3', vote: 'Nay' },
            ],
          },
          {
            failed: false,
            chaos: false,
            votes: [
              { playerId: pid, vote: 'Nay' },
              { playerId: 'p2', vote: 'Aye' },
              { playerId: 'p3', vote: 'Aye' },
            ],
          },
        ],
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });
  });

  describe('The Dove', () => {
    const agenda = AGENDA_MAP.get('the_dove')!;

    it('returns failed if ever voted Nay', () => {
      const state = {
        roundHistory: [
          { votes: [{ playerId: pid, vote: 'Aye' }] },
          { votes: [{ playerId: pid, vote: 'Nay' }] },
        ],
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('failed');
    });

    it('returns completed if only voted Aye and game over', () => {
      const state = {
        roundHistory: [{ votes: [{ playerId: pid, vote: 'Aye' }] }],
        phase: 'GameOver',
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });
  });

  describe('Short Session', () => {
    const agenda = AGENDA_MAP.get('short_session')!;

    it('returns completed if game over before round player count + 3', () => {
      const state = {
        players: Array(5).fill({}),
        round: 7, // 7 < 8
        phase: 'GameOver',
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });

    it('returns failed if round >= player count + 3', () => {
      const state = {
        players: Array(5).fill({}),
        round: 8,
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('failed');
    });
  });

  describe('The Long Game', () => {
    const agenda = AGENDA_MAP.get('the_long_game')!;

    it('returns completed if round >= player count + 6', () => {
      const state = {
        players: Array(5).fill({}),
        round: 11, // 5 + 6 = 11
      } as GameState;
      expect(agenda.evaluate(state, pid)).toBe('completed');
    });
  });
});

