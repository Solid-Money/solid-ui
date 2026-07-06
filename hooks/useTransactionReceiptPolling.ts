import { useEffect, useMemo, useRef } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getTransactionReceipt } from 'viem/actions';

import { useActivityActions } from '@/hooks/useActivityActions';
import { ActivityEvent, TransactionStatus } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

/**
 * Polls the blockchain for a transaction receipt when a single activity is
 * stuck at PROCESSING with a known tx hash. Used on the activity detail page.
 */
export const useTransactionReceiptPolling = (activity: ActivityEvent | null | undefined) => {
  const { updateActivity } = useActivityActions();

  const shouldPoll =
    !!activity &&
    activity.status === TransactionStatus.PROCESSING &&
    !!activity.hash &&
    !!activity.chainId;

  return useQuery({
    queryKey: ['tx-receipt-poll', activity?.clientTxId, activity?.hash],
    queryFn: async () => {
      if (!activity?.hash || !activity?.chainId) return null;

      try {
        const receipt = await getTransactionReceipt(publicClient(activity.chainId), {
          hash: activity.hash as `0x${string}`,
        });

        if (receipt) {
          const newStatus =
            receipt.status === 'success' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;

          updateActivity(activity.clientTxId, { status: newStatus });
          return { status: newStatus, confirmed: true };
        }
      } catch {
        // Receipt not available yet — keep polling
      }

      return { status: activity.status, confirmed: false };
    },
    enabled: shouldPoll,
    refetchInterval: query => {
      const data = query.state.data;
      if (data?.confirmed) return false;
      return 5_000;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  });
};

/**
 * Polls blockchain receipts for multiple activities stuck at PROCESSING.
 * Used on the activity list page to resolve wallet transfers that didn't
 * get their receipt confirmed before the user navigated away.
 */
export const useProcessingActivitiesPolling = (activities: ActivityEvent[]) => {
  const { updateActivity } = useActivityActions();
  const confirmedRef = useRef<Set<string>>(new Set());

  const processingActivities = useMemo(
    () =>
      activities.filter(
        a =>
          a.status === TransactionStatus.PROCESSING &&
          a.hash &&
          a.chainId &&
          !confirmedRef.current.has(a.clientTxId),
      ),
    [activities],
  );

  const results = useQueries({
    queries: processingActivities.map(activity => ({
      queryKey: ['tx-receipt-poll', activity.clientTxId, activity.hash],
      queryFn: async () => {
        try {
          const receipt = await getTransactionReceipt(publicClient(activity.chainId!), {
            hash: activity.hash as `0x${string}`,
          });

          if (receipt) {
            const newStatus =
              receipt.status === 'success' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
            return { clientTxId: activity.clientTxId, status: newStatus, confirmed: true };
          }
        } catch {
          // Receipt not available yet
        }
        return { clientTxId: activity.clientTxId, status: activity.status, confirmed: false };
      },
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
      staleTime: 0,
      gcTime: 0,
    })),
  });

  // Update activities when receipts are confirmed
  useEffect(() => {
    for (const result of results) {
      const data = result.data;
      if (data?.confirmed && !confirmedRef.current.has(data.clientTxId)) {
        confirmedRef.current.add(data.clientTxId);
        updateActivity(data.clientTxId, { status: data.status });
      }
    }
  }, [results, updateActivity]);
};
