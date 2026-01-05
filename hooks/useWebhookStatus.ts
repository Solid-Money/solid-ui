import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import useUser from '@/hooks/useUser';
import { ensureWebhookSubscription, getWebhookStatus } from '@/lib/api';
import { EnsureWebhookResponse, WebhookStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

interface UseWebhookStatusOptions {
  /** Whether to automatically subscribe when user has safeAddress but not registered */
  autoSubscribe?: boolean;
}

interface UseWebhookStatusReturn {
  /** Current webhook status */
  status: WebhookStatus | null;
  /** Whether status is loading */
  isLoading: boolean;
  /** Whether subscription is in progress */
  isSubscribing: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually trigger subscription */
  subscribe: () => Promise<EnsureWebhookResponse | undefined>;
  /** Refresh status */
  refetch: () => void;
  /** Whether user is registered for webhooks */
  isRegistered: boolean;
  /** Number of registered chains */
  registeredChainCount: number;
}

/**
 * Hook for managing webhook registration status.
 *
 * Features:
 * - Fetches current webhook status via React Query
 * - Auto-subscribes when user has safeAddress but not registered
 * - Mutation for manual subscription
 * - Cache invalidation on successful subscription
 */
export function useWebhookStatus(options: UseWebhookStatusOptions = {}): UseWebhookStatusReturn {
  const { autoSubscribe = true } = options;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const hasAutoSubscribedRef = useRef(false);

  const userId = user?.userId;
  const safeAddress = user?.safeAddress;

  // Query for webhook status
  const statusQuery = useQuery({
    queryKey: ['webhook-status', userId],
    queryFn: () => withRefreshToken(() => getWebhookStatus()),
    enabled: !!userId && !!safeAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  // Mutation for subscribing to webhooks
  const subscribeMutation = useMutation({
    mutationKey: ['ensure-webhook-subscription', userId],
    mutationFn: () => withRefreshToken(() => ensureWebhookSubscription()),
    onSuccess: () => {
      // Invalidate status query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['webhook-status', userId] });
    },
    onError: (error: any) => {
      console.error('Failed to subscribe to webhooks:', error);
    },
  });

  // Extract stable references from mutation
  const { mutate: doSubscribe, isPending: isSubscribePending } = subscribeMutation;

  // Auto-subscribe when user has safeAddress but not registered
  useEffect(() => {
    if (!autoSubscribe || !userId || !safeAddress) return;
    if (hasAutoSubscribedRef.current) return;
    if (statusQuery.isLoading || isSubscribePending) return;

    const status = statusQuery.data;

    // If we have status and user is not registered, subscribe
    if (status && !status.registered) {
      hasAutoSubscribedRef.current = true;
      doSubscribe();
    }

    // Also subscribe if we got an error fetching status (might be first time)
    if (statusQuery.isError && !isSubscribePending) {
      hasAutoSubscribedRef.current = true;
      doSubscribe();
    }
  }, [
    autoSubscribe,
    userId,
    safeAddress,
    statusQuery.data,
    statusQuery.isLoading,
    statusQuery.isError,
    isSubscribePending,
    doSubscribe,
  ]);

  // Reset auto-subscribe flag when user changes
  useEffect(() => {
    hasAutoSubscribedRef.current = false;
  }, [userId]);

  // Manual subscribe function
  const subscribe = async () => {
    if (!userId || !safeAddress) {
      console.error('Cannot subscribe: user not authenticated or no safe address');
      return undefined;
    }

    return subscribeMutation.mutateAsync();
  };

  // Refetch status
  const refetch = () => {
    statusQuery.refetch();
  };

  // Derived state
  const status = statusQuery.data ?? null;
  const isRegistered = status?.registered ?? false;
  const registeredChainCount = status?.registeredChains?.length ?? 0;

  // Error handling
  let error: string | null = null;
  if (statusQuery.error) {
    error = (statusQuery.error as any)?.message || 'Failed to fetch webhook status';
  } else if (subscribeMutation.error) {
    error = (subscribeMutation.error as any)?.message || 'Failed to subscribe to webhooks';
  }

  return {
    status,
    isLoading: statusQuery.isLoading,
    isSubscribing: subscribeMutation.isPending,
    error,
    subscribe,
    refetch,
    isRegistered,
    registeredChainCount,
  };
}
