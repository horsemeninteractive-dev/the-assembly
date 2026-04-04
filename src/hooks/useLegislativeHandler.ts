import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player } from '../../shared/types';

interface UseLegislativeHandlerProps {
  gameState: GameState;
  me: Player | undefined;
  socket: Socket;
}

export function useLegislativeHandler({
  gameState,
  me,
  socket,
}: UseLegislativeHandlerProps) {
  const [showDeclarationUI, setShowDeclarationUI] = useState(false);
  const [declarationType, setDeclarationType] = useState<'President' | 'Chancellor' | null>(null);
  const [declCiv, setDeclCiv] = useState(0);
  const [declSta, setDeclSta] = useState(0);
  const [declDrawCiv, setDeclDrawCiv] = useState(0);
  const [declDrawSta, setDeclDrawSta] = useState(3);
  const [showPolicyAnim, setShowPolicyAnim] = useState(false);

  const showPolicyAnimRef = useRef(false);
  const pendingDeclarationRef = useRef<'President' | 'Chancellor' | null>(null);
  const chancellorSinceRef = useRef<number>(0);
  const wasChancellorRef = useRef(false);
  const presidentPromptedForRef = useRef<string>('');
  const chancellorPromptedForRef = useRef<string>('');
  const lastSeenPolicyIdRef = useRef<string>('');

  useEffect(() => {
    showPolicyAnimRef.current = showPolicyAnim;
    if (showPolicyAnim) {
      const timer = setTimeout(() => setShowPolicyAnim(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showPolicyAnim]);

  useEffect(() => {
    if (!gameState.lastEnactedPolicy) return;
    const key = `${gameState.lastEnactedPolicy.type}-${gameState.lastEnactedPolicy.playerId ?? ''}-${Math.floor(gameState.lastEnactedPolicy.timestamp / 10000)}`;
    if (key !== lastSeenPolicyIdRef.current) {
      lastSeenPolicyIdRef.current = key;
      setShowPolicyAnim(true);
    }
  }, [gameState.lastEnactedPolicy]);

  useEffect(() => {
    if (!showPolicyAnim && pendingDeclarationRef.current) {
      const type = pendingDeclarationRef.current;
      pendingDeclarationRef.current = null;
      setDeclarationType(type);
      if (type === 'President') {
        setDeclCiv(0);
        setDeclSta(2);
        setDeclDrawCiv(0);
        setDeclDrawSta(3);
      } else {
        setDeclCiv(0);
        setDeclSta(2);
      }
      setShowDeclarationUI(true);
    }
  }, [showPolicyAnim]);

  useEffect(() => {
    if (!me) return;
    const alreadyDeclared = gameState.declarations.some((d) => d.playerId === socket.id);
    if (alreadyDeclared || gameState.phase === 'GameOver') {
      pendingDeclarationRef.current = null;
      setShowDeclarationUI(false);
      return;
    }
    if (me.isChancellor && !wasChancellorRef.current) chancellorSinceRef.current = Date.now();
    wasChancellorRef.current = !!me.isChancellor;

    const trackerReady = gameState.lastEnactedPolicy?.trackerReady === true;
    if (!trackerReady || !gameState.lastEnactedPolicy) return;

    const policyKey = `${gameState.lastEnactedPolicy.type}-${gameState.lastEnactedPolicy.playerId ?? ''}-${Math.floor(gameState.lastEnactedPolicy.timestamp / 1000)}`;

    let needed: 'President' | 'Chancellor' | null = null;
    if (me.isPresident && !gameState.presidentDeclarationBlocked && presidentPromptedForRef.current !== policyKey) {
      presidentPromptedForRef.current = policyKey;
      needed = 'President';
    }

    const presidentDeclared = gameState.declarations.some((d) => d.type === 'President') || gameState.presidentDeclarationBlocked;
    if (me.isChancellor && presidentDeclared && chancellorPromptedForRef.current !== policyKey) {
      const policyEnactedThisTerm =
        (gameState.lastEnactedPolicy?.timestamp ?? 0) > chancellorSinceRef.current;
      if (policyEnactedThisTerm) {
        chancellorPromptedForRef.current = policyKey;
        needed = 'Chancellor';
      }
    }

    if (needed) {
      if (!showPolicyAnimRef.current) {
        pendingDeclarationRef.current = null;
        setDeclarationType(needed);
        if (needed === 'President') {
          setDeclCiv(0);
          setDeclSta(2);
          setDeclDrawCiv(0);
          setDeclDrawSta(3);
        } else {
          setDeclCiv(0);
          setDeclSta(2);
        }
        setShowDeclarationUI(true);
      } else {
        pendingDeclarationRef.current = needed;
      }
    }
  }, [me, gameState.declarations, gameState.lastEnactedPolicy, gameState.phase, socket.id]);

  const handleSubmitDeclaration = () => {
    if (!declarationType) return;
    socket.emit('declarePolicies', {
      civ: declCiv,
      sta: declSta,
      ...(declarationType === 'President' ? { drewCiv: declDrawCiv, drewSta: declDrawSta } : {}),
      type: declarationType,
    });
    setShowDeclarationUI(false);
  };

  return {
    showDeclarationUI,
    setShowDeclarationUI,
    declarationType,
    declCiv,
    declSta,
    declDrawCiv,
    declDrawSta,
    setDeclCiv,
    setDeclSta,
    setDeclDrawCiv,
    setDeclDrawSta,
    showPolicyAnim,
    handleSubmitDeclaration,
  };
}


