import { GameState, Player } from '../../../shared/types';
import { addLog, pick } from '../utils';
import { updateSuspicionFromNomination } from '../../game/suspicion';
import type { IRoundManagerContext } from '../RoundManager';

export class ElectionManager {
  constructor(private readonly round: any) {} // RoundManager reference

  get EligibleChancellors(): (s: GameState, presidentId: string) => Player[] {
    return (s: GameState, presidentId: string) => {
      const alive = s.players.filter((p) => p.isAlive).length;
      return s.players.filter(
        (p) =>
          p.isAlive &&
          p.id !== presidentId &&
          p.id !== s.rejectedChancellorId &&
          p.id !== s.detainedPlayerId &&
          !p.wasChancellor &&
          !(alive > 5 && p.wasPresident)
      );
    };
  }

  beginNomination(s: GameState, roomId: string): void {
    this.round.resetPlayerActions(s);
    s.presidentTimedOut = false;
    s.chancellorTimedOut = false;
    s.drawnPolicies = [];
    s.chancellorPolicies = [];
    s.presidentSaw = undefined;
    s.chancellorSaw = undefined;
    s.lastEnactedPolicy = undefined;
    s.isStrategistAction = undefined;

    s.players[s.presidentIdx].isPresidentialCandidate = true;
    addLog(s, `${s.players[s.presidentIdx].name} is the Presidential Candidate.`);

    const interdictor = s.players.find(
      (p) =>
        p.titleRole === 'Interdictor' &&
        !p.titleUsed &&
        p.isAlive &&
        p.id !== s.players[s.presidentIdx].id
    );

    if (interdictor && s.round > 1) {
      s.titlePrompt = {
        playerId: interdictor.id,
        role: 'Interdictor',
        context: { role: 'Interdictor' },
        nextPhase: 'Nominate_Chancellor',
      };
      this.round.enterPhase(s, roomId, 'Nomination_Review');
    } else {
      this.round.enterPhase(s, roomId, 'Nominate_Chancellor');
    }
  }

  nominate(
    s: GameState,
    roomId: string,
    chancellorId: string,
    presidentId: string
  ): void {
    if (s.titlePrompt) return;
    if (s.phase !== 'Nominate_Chancellor') return;

    const president = s.players[s.presidentIdx];
    if (president.id !== presidentId || !president.isAlive || president.hasActed) return;
    president.hasActed = true;

    const chancellor = s.players.find((p) => p.id === chancellorId);
    if (!chancellor || !chancellor.isAlive || chancellor.id === president.id) return;

    if (s.rejectedChancellorId === chancellor.id) {
      this.round.engine.io
        .to(president.socketId)
        .emit('error', 'This player was rejected by the Broker and cannot be nominated again this round.');
      president.hasActed = false;
      return;
    }
    if (s.detainedPlayerId === chancellor.id) {
      this.round.engine.io
        .to(president.socketId)
        .emit('error', 'This player is detained by the Interdictor and cannot be nominated.');
      president.hasActed = false;
      return;
    }

    const alive = s.players.filter((p) => p.isAlive).length;
    if (chancellor.wasChancellor || (alive > 5 && chancellor.wasPresident)) {
      this.round.engine.io.to(president.socketId).emit('error', 'Player is ineligible due to term limits.');
      president.hasActed = false;
      return;
    }

    s.players.forEach((p) => (p.isChancellorCandidate = false));
    chancellor.isChancellorCandidate = true;
    addLog(s, `${president.name} nominated ${chancellor.name} for Chancellor.`);
    updateSuspicionFromNomination(s, president.id, chancellor.id);
    this.round.engine.aiEngine.triggerAIReactions(s, roomId, 'nomination', { targetId: chancellor.id });
    this.advanceToVotingOrBroker(s, roomId);
  }

  advanceToVotingOrBroker(s: GameState, roomId: string): void {
    const broker = s.players.find((p) => p.titleRole === 'Broker' && !p.titleUsed && p.isAlive);
    if (broker) {
      s.titlePrompt = {
        playerId: broker.id,
        role: 'Broker',
        context: { role: 'Broker' },
        nextPhase: 'Voting',
      };
      this.round.enterPhase(s, roomId, 'Nomination_Review');
    } else {
      this.round.enterPhase(s, roomId, 'Voting');
    }
  }

  tallyVotes(s: GameState, roomId: string): void {
    if (!s.previousVotes) s.previousVotes = {};
    for (const p of s.players) {
      if (p.vote) s.previousVotes[p.id] = p.vote;
    }

    const aye = s.players.filter((p) => p.vote === 'Aye').length;
    const nay = s.players.filter((p) => p.vote === 'Nay').length;
    s.players.forEach((p) => (p.vote = undefined));

    s.actionTimerEnd = Date.now() + 4000;
    s.declarations = [];
    this.round.enterPhase(s, roomId, 'Voting_Reveal');

    setTimeout(async () => {
      const st = this.round.engine.rooms.get(roomId);
      if (!st || st.phase !== 'Voting_Reveal') return;
      st.actionTimerEnd = undefined;
      const votes = st.previousVotes;
      st.previousVotes = undefined;

      if (aye > nay) {
        await this.electionPassed(st, roomId, aye, nay, votes ?? {});
      } else {
        await this.electionFailed(st, roomId, aye, nay, votes ?? {});
      }
    }, 4000);
  }

  private async electionPassed(
    s: GameState,
    roomId: string,
    aye: number,
    nay: number,
    votes: Record<string, 'Aye' | 'Nay'>
  ): Promise<void> {
    addLog(s, `Election passed! (${aye} Aye, ${nay} Nay)`);

    const chancellor = s.players.find((p) => p.isChancellorCandidate);
    const president = s.players.find((p) => p.isPresidentialCandidate);
    if (!chancellor || !president) {
      addLog(s, '[ERROR] electionPassed: missing candidates.');
      this.round.nextRound(s, roomId, false);
      return;
    }

    if (s.stateDirectives >= 3) {
      if (chancellor.role === 'Overseer') {
        addLog(s, 'The Overseer was elected Chancellor — State Supremacy!');
        await this.round.engine.matchCloser.endGame(s, roomId, 'State', 'THE OVERSEER HAS ASCENDED');
        return;
      } else {
        chancellor.isProvenNotOverseer = true;
      }
    }

    this.round.resetPlayerActions(s);
    s.players.forEach((p) => {
      p.isPresident = false;
      p.isChancellor = false;
    });
    president.isPresident = true;
    chancellor.isChancellor = true;
    s.presidentId = president.id;
    s.chancellorId = chancellor.id;
    s.electionTracker = 0;

    s.lastGovernmentVotes = { ...votes };
    s.lastGovernmentPresidentId = president.id;
    s.lastGovernmentChancellorId = chancellor.id;
    updateSuspicionFromNomination(s, president.id, chancellor.id);

    this.round.legislative.startPresidentialPhase(s, roomId, president);
  }

  private async electionFailed(
    s: GameState,
    roomId: string,
    aye: number,
    nay: number,
    votes: Record<string, 'Aye' | 'Nay'>
  ): Promise<void> {
    addLog(s, `Election failed! (${aye} Aye, ${nay} Nay)`);

    const presPlayer = s.players[s.presidentIdx];
    const chanPlayer = s.players.find((p) => p.isChancellorCandidate);
    if (!s.roundHistory) s.roundHistory = [];
    s.roundHistory.push({
      round: s.round,
      presidentName: presPlayer?.name ?? '?',
      chancellorName: chanPlayer?.name ?? '?',
      presidentId: presPlayer?.id,
      chancellorId: chanPlayer?.id,
      failed: true,
      failReason: 'vote',
      votes: Object.entries(votes).map(([pid, v]) => {
        const pl = s.players.find((p) => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v };
      }),
    });

    s.electionTracker++;
    if (s.electionTracker >= 3) {
      await this.round.legislative.enactChaosPolicy(s, roomId);
    } else {
      this.round.engine.aiEngine.triggerAIReactions(s, roomId, 'failed_vote');
      this.round.nextRound(s, roomId, false);
    }
  }
}

