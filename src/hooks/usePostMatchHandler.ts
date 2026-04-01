import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Policy, Role, PostMatchResult } from '../../shared/types';

interface UsePostMatchHandlerProps {
  socket: Socket;
  token: string | null;
  setPeekedPolicies: (policies: Policy[] | null) => void;
  setPeekTitle: (title: string | undefined) => void;
  setInvestigationResult: (result: { targetName: string; role: Role } | null) => void;
  setPostMatchResult: (result: PostMatchResult | null) => void;
}

export function usePostMatchHandler({
  socket,
  token,
  setPeekedPolicies,
  setPeekTitle,
  setInvestigationResult,
  setPostMatchResult,
}: UsePostMatchHandlerProps) {
  useEffect(() => {
    const handlePeek = (policies: Policy[], title?: string) => {
      setPeekedPolicies(policies);
      setPeekTitle(title);
    };
    const handleInvestigation = (result: { targetName: string; role: Role }) => {
      setInvestigationResult(result);
    };
    const handlePostMatch = (result: PostMatchResult) => {
      setPostMatchResult(result);
    };

    socket.on('policyPeekResult', handlePeek);
    socket.on('investigationResult', handleInvestigation);
    socket.on('postMatchResult', handlePostMatch);

    return () => {
      socket.off('policyPeekResult', handlePeek);
      socket.off('investigationResult', handleInvestigation);
      socket.off('postMatchResult', handlePostMatch);
    };
  }, [token, socket]);
}


