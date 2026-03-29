import { useEffect, useRef } from 'react';
import { GameState, Player } from '../types';
import * as aiSpeech from '../services/aiSpeech';

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
  const prevPhase = useRef<string | undefined>(undefined);
  const prevVotes = useRef(0);
  const prevCivilDirectives = useRef(0);
  const prevStateDirectives = useRef(0);
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
      if (gameState.phase === 'Legislative_President') playSound('election_passed');
      else if (gameState.phase === 'Nominate_Chancellor') playSound('election_failed');
    }

    if (gameState.civilDirectives > prevCivilDirectives.current) speak('Charter secured.');
    if (gameState.stateDirectives > prevStateDirectives.current) speak('The State advances.');
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
        aiSpeech.speakAiMessage(
          lastMessage.text,
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
