import { useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import {
  createDirectDepositSession as createDirectDepositSessionApi,
  deleteDirectDepositSession as deleteDirectDepositSessionApi,
  getDirectDepositSession as getDirectDepositSessionApi,
} from '@/lib/api';
import { DirectDepositSessionResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import { useActivity } from './useActivity';

export const useDirectDepositSession = () => {
  const { setDirectDepositSession, clearDirectDepositSession } = useDepositStore(
    useShallow(state => ({
      setDirectDepositSession: state.setDirectDepositSession,
      clearDirectDepositSession: state.clearDirectDepositSession,
    })),
  );
  const { refetchAll } = useActivity();

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: async ({ chainId, tokenSymbol }: { chainId: number; tokenSymbol: string }) => {
      const data = await withRefreshToken(() =>
        createDirectDepositSessionApi(chainId, tokenSymbol),
      );
      if (!data) throw new Error('Failed to create direct deposit session');
      return { data, chainId, tokenSymbol };
    },
    onSuccess: ({ data, chainId, tokenSymbol }) => {
      // Track successful session creation
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_CREATED, {
        deposit_method: 'deposit_directly',
        session_id: data.sessionId,
        chain_id: chainId,
        selected_token: tokenSymbol,
        wallet_address: data.walletAddress,
      });

      // Store in zustand (explicitly clear fromActivity flag)
      setDirectDepositSession({
        ...data,
        fromActivity: false,
      });

      refetchAll(true);
    },
    onError: (err, { chainId, tokenSymbol }) => {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Track session creation failure
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_CREATION_FAILED, {
        deposit_method: 'deposit_directly',
        chain_id: chainId,
        selected_token: tokenSymbol,
        error: errorMessage,
      });
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (clientTxId: string) => {
      const data = await withRefreshToken(() => deleteDirectDepositSessionApi(clientTxId));
      return { data, clientTxId };
    },
    onSuccess: async ({ clientTxId }) => {
      // Track successful session deletion
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_DELETED, {
        deposit_method: 'deposit_directly',
        client_tx_id: clientTxId,
      });

      // Clear from zustand store
      clearDirectDepositSession();

      refetchAll(true);
      // Wait for activities to settle
      await new Promise(resolve => setTimeout(resolve, 3000));
    },
  });

  const createDirectDepositSession = useCallback(async (chainId: number, tokenSymbol: string) => {
    // Reset delete mutation's error state to prevent stale errors
    deleteMutation.reset();
    const result = await createMutation.mutateAsync({ chainId, tokenSymbol });
    return result.data;
  }, [createMutation, deleteMutation]);

  const getDirectDepositSession = useCallback(async (sessionId: string) => {
    try {
      const data = await withRefreshToken(() => getDirectDepositSessionApi(sessionId));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(errorMessage);
    }
  }, []);

  const deleteDirectDepositSession = useCallback(async (clientTxId: string) => {
    // Reset create mutation's error state to prevent stale errors
    createMutation.reset();
    const result = await deleteMutation.mutateAsync(clientTxId);
    return result.data;
  }, [createMutation, deleteMutation]);

  // Combine loading states from both mutations
  const isLoading = createMutation.isPending || deleteMutation.isPending;

  // Get error from whichever mutation failed (simplified logic)
  const mutationError = createMutation.error ?? deleteMutation.error;
  const error = mutationError
    ? mutationError instanceof Error
      ? mutationError.message
      : 'Unknown error'
    : null;

  return {
    isLoading,
    error,
    createDirectDepositSession,
    getDirectDepositSession,
    deleteDirectDepositSession,
  };
};

export const useDirectDepositSessionPolling = (
  sessionId: string | undefined,
  enabled: boolean = true,
) => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { setDirectDepositSession, directDepositSession } = useDepositStore(
    useShallow(state => ({
      setDirectDepositSession: state.setDirectDepositSession,
      directDepositSession: state.directDepositSession,
    })),
  );
  const previousStatusRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery<DirectDepositSessionResponse | null>({
    queryKey: ['directDepositSession', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const data = await withRefreshToken(() => getDirectDepositSessionApi(sessionId));

      if (!data) return null;

      // Initialize session start time when first created
      if (!sessionStartTimeRef.current && data.status === 'pending') {
        sessionStartTimeRef.current = Date.now();
      }

      // Track status changes
      const previousStatus = previousStatusRef.current;
      const currentStatus = data.status;

      if (previousStatus !== currentStatus) {
        // Track when deposit is detected
        if (currentStatus === 'detected') {
          const timeToDetection = sessionStartTimeRef.current
            ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
            : undefined;

          track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_DETECTED, {
            deposit_method: 'deposit_directly',
            session_id: data.sessionId,
            chain_id: data.chainId,
            selected_token: directDepositSession.selectedToken,
            detected_amount: data.detectedAmount,
            time_to_detection: timeToDetection,
          });
        }

        // Track when deposit is completed
        if (currentStatus === 'completed') {
          const timeToCompletion = sessionStartTimeRef.current
            ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
            : undefined;

          track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_COMPLETED, {
            deposit_method: 'deposit_directly',
            session_id: data.sessionId,
            chain_id: data.chainId,
            selected_token: directDepositSession.selectedToken,
            transaction_hash: data.transactionHash,
            time_to_completion: timeToCompletion,
          });
        }

        previousStatusRef.current = currentStatus;
      }

      // Update zustand store
      setDirectDepositSession(data);

      return data;
    },
    enabled: enabled && !!sessionId,
    refetchInterval: query => {
      const status = query.state.data?.status;
      // Stop polling when completed, failed, or expired
      if (status === 'completed' || status === 'failed' || status === 'expired') {
        return false;
      }
      // Poll every 5 seconds for pending, detected, processing
      return 5000;
    },
    refetchIntervalInBackground: true,
  });

  return {
    session,
    isLoading,
    error,
    refetch,
  };
};
