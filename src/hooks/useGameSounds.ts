import { useEffect, useRef } from 'react';
import { GameState, Player } from '../../shared/types';
import * as aiSpeech from '../services/aiSpeech';
import { parseAiChat } from '../utils/utils';
import { useTranslation } from '../contexts/I18nContext';
interface UseGameSoundsProps {
  gameState: GameState;
  me: Player | undefined;
  playSound: (soundKey: string) => void;
  isSoundOn: boolean;
  ttsVoice: string;
  ttsVolume: number;
  isAiVoiceEnabled: boolean;
  ttsEngine: string;
  soundVolume: number;
  isLogOpen: boolean;
  isChatOpen: boolean;
  isHistoryOpen: boolean;
  isDossierOpen: boolean;
  isReferenceOpen: boolean;
  peekedPolicies: any[] | null;
  investigationResult: any | null;
  showDeclarationUI: boolean;
  selectedPlayerId: string | null;
  setSpeakingPlayers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function useGameSounds({
  gameState,
  me,
  playSound,
  isSoundOn,
  ttsVoice,
  ttsVolume,
  isAiVoiceEnabled,
  ttsEngine,
  soundVolume,
  isLogOpen,
  isChatOpen,
  isHistoryOpen,
  isDossierOpen,
  isReferenceOpen,
  peekedPolicies,
  investigationResult,
  showDeclarationUI,
  selectedPlayerId,
  setSpeakingPlayers,
}: UseGameSoundsProps) {
  const { t } = useTranslation();
  const prevPhase = useRef<string | undefined>(undefined);
  const prevVotes = useRef(0);
  const prevCivilDirectives = useRef(0);
  const prevStateDirectives = useRef(0);
  const prevElectionTracker = useRef(0);
  const prevVetoRequested = useRef(false);
  const prevAliveCount = useRef(0);
  const lastSpokenMessageIndexRef = useRef(-1);

  const prevPanelsState = useRef({
    isLogOpen,
    isChatOpen,
    isHistoryOpen,
    isDossierOpen,
    isReferenceOpen,
    isPeekOpen: !!peekedPolicies,
    isInvestigationOpen: !!investigationResult,
    isDeclarationOpen: showDeclarationUI,
    isProfileOpen: !!selectedPlayerId,
  });

  const speak = (text: string) => {
    if (!isSoundOn) return;
    aiSpeech.speak(text, {
      voice: ttsVoice,
      volume: ttsVolume / 100,
      rate: 0.9,
      pitch: 0.8,
    });
  };

  useEffect(() => {
    aiSpeech.initVoices();
    return () => {
      aiSpeech.stop();
    };
  }, []);

  useEffect(() => {
    const currentVotes = gameState.players.filter((p) => p.vote).length;
    if (currentVotes > prevVotes.current && me && !me.vote) playSound('click');
    prevVotes.current = currentVotes;

    const currentAliveCount = gameState.players.filter((p) => p.isAlive).length;
    if (prevAliveCount.current > 0 && currentAliveCount < prevAliveCount.current)
      playSound('death');
    prevAliveCount.current = currentAliveCount;

    if (
      (prevPhase.current === 'Voting' || prevPhase.current === 'Voting_Reveal') &&
      gameState.phase !== 'Voting' &&
      gameState.phase !== 'Voting_Reveal'
    ) {
      if (gameState.phase === 'Legislative_President') {
        playSound('election_passed');
        speak(t('game.narration.election_passed'));
      } else if (gameState.phase === 'Nominate_Chancellor') {
        playSound('election_failed');
        if (gameState.electionTracker > prevElectionTracker.current) {
          speak(t('game.narration.election_failed'));
        }
      }
    }

    if (prevPhase.current !== gameState.phase) {
      if (gameState.phase === 'Nominate_Chancellor') {
        if (prevPhase.current !== 'Voting' && prevPhase.current !== 'Voting_Reveal' && prevPhase.current !== 'Legislative_Chancellor') {
          speak(t('game.narration.nomination'));
        }
      } else if (gameState.phase === 'Voting') {
        speak(t('game.narration.voting_start'));
      } else if (gameState.phase === 'Executive_Action') {
        const action = gameState.currentExecutiveAction;
        if (action === 'Investigate') speak(t('game.narration.executive_investigate'));
        else if (action === 'PolicyPeek') speak(t('game.narration.executive_peek'));
        else if (action === 'SpecialElection') speak(t('game.narration.executive_election'));
        else if (action === 'Execution') speak(t('game.narration.executive_assassinate'));
      }
    }

    if (gameState.civilDirectives > prevCivilDirectives.current) {
      if (gameState.lastEnactedPolicy?.isChaos) {
        speak(t('game.narration.chaos'));
      } else {
        speak(t('game.narration.directive_civil'));
      }
    }
    if (gameState.stateDirectives > prevStateDirectives.current) {
      if (gameState.lastEnactedPolicy?.isChaos) {
        speak(t('game.narration.chaos'));
      } else {
        speak(t('game.narration.directive_state'));
      }
    }

    if (!prevVetoRequested.current && gameState.vetoRequested) {
      speak(t('game.narration.veto_request'));
    }
    if (prevPhase.current === 'Legislative_Chancellor' && gameState.phase === 'Nominate_Chancellor' && prevVetoRequested.current) {
      if (gameState.civilDirectives === prevCivilDirectives.current && gameState.stateDirectives === prevStateDirectives.current) {
        speak(t('game.narration.veto_confirm'));
      }
    }

    prevElectionTracker.current = gameState.electionTracker;
    prevVetoRequested.current = gameState.vetoRequested;
    prevCivilDirectives.current = gameState.civilDirectives;
    prevStateDirectives.current = gameState.stateDirectives;

    if (prevPhase.current !== 'GameOver' && gameState.phase === 'GameOver') {
      if (gameState.winner === 'Civil') playSound('win_civil');
      else if (gameState.winner === 'State') playSound('win_state');
    }

    prevPhase.current = gameState.phase;
  }, [gameState, me, playSound]);

  useEffect(() => {
    const current = {
      isLogOpen,
      isChatOpen,
      isHistoryOpen,
      isDossierOpen,
      isReferenceOpen,
      isPeekOpen: !!peekedPolicies,
      isInvestigationOpen: !!investigationResult,
      isDeclarationOpen: showDeclarationUI,
      isProfileOpen: !!selectedPlayerId,
    };

    const opened = Object.keys(current).some(
      (k) => (current as any)[k] && !(prevPanelsState.current as any)[k]
    );
    const closed = Object.keys(current).some(
      (k) => !(current as any)[k] && (prevPanelsState.current as any)[k]
    );

    if (opened) playSound('modal_open');
    else if (closed) playSound('modal_close');

    prevPanelsState.current = current;
  }, [
    isLogOpen,
    isChatOpen,
    isHistoryOpen,
    isDossierOpen,
    isReferenceOpen,
    peekedPolicies,
    investigationResult,
    showDeclarationUI,
    selectedPlayerId,
    playSound,
  ]);

  useEffect(() => {
    if (!isAiVoiceEnabled) return;
    const msgCount = gameState.messages.length;
    if (msgCount === 0) return;

    if (msgCount - 1 <= lastSpokenMessageIndexRef.current) return;
    lastSpokenMessageIndexRef.current = msgCount - 1;

    const lastMessage = gameState.messages[msgCount - 1];
    if (!lastMessage) return;

    const sender = gameState.players.find((p) => p.name === lastMessage.sender);
    if (sender && sender.isAI) {
      const profile = aiSpeech.getVoiceProfileForAi(sender.name);
      if (profile) {
        const parsedText = parseAiChat(lastMessage.text, t);
        aiSpeech.speakAiMessage(
          parsedText,
          sender.name,
          profile,
          ttsVolume / 100,
          () => setSpeakingPlayers((prev) => ({ ...prev, [sender.id]: true })),
          () => setSpeakingPlayers((prev) => ({ ...prev, [sender.id]: false }))
        );
      }
    }
  }, [gameState.messages.length, isAiVoiceEnabled, ttsEngine, soundVolume, ttsVolume]);
}


