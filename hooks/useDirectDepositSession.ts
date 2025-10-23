import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createDirectDepositSession as createDirectDepositSessionApi,
  getDirectDepositSession as getDirectDepositSessionApi,
} from '@/lib/api';
import { DirectDepositSessionResponse } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { withRefreshToken } from '@/lib/utils';

export const useDirectDepositSession = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setDirectDepositSession } = useDepositStore();

  const createDirectDepositSession = async (chainId: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await withRefreshToken(() => createDirectDepositSessionApi(chainId));

      if (!data) throw new Error('Failed to create direct deposit session');

      // Store in zustand
      setDirectDepositSession(data);

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getDirectDepositSession = async (sessionId: string) => {
    try {
      const data = await withRefreshToken(() => getDirectDepositSessionApi(sessionId));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(errorMessage);
    }
  };

  return {
    isLoading,
    error,
    createDirectDepositSession,
    getDirectDepositSession,
  };
};

export const useDirectDepositSessionPolling = (
  sessionId: string | undefined,
  enabled: boolean = true,
) => {
  const { setDirectDepositSession } = useDepositStore();

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
