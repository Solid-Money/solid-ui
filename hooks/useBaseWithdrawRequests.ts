import { useCallback, useMemo } from 'react';
import { QueryObserverResult, useQueries } from '@tanstack/react-query';
import { Hex } from 'viem';
import { base } from 'viem/chains';

import { isSoUsdBaseConfigured } from '@/lib/soUsdWithdraw';
import { BaseWithdrawRequest, readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

export const BASE_WITHDRAW_REQUEST = 'baseWithdrawRequest';

/** How often a request still in the queue is re-read. Solves run every few hours. */
const PENDING_REFETCH_MS = 60_000;
/** Lets the many screens that mount useActivity share one read of a pending request. */
const PENDING_STALE_MS = 30_000;

/**
 * A soUSD withdraw request made on the Base queue: its transaction confirmed,
 * so it is in the queue or has left it.
 */
export const isBaseWithdrawRequest = (
  activity: ActivityEvent,
): activity is ActivityEvent & {
  hash: string;
} =>
  activity.type === TransactionType.WITHDRAW &&
  activity.chainId === base.id &&
  activity.status === TransactionStatus.SUCCESS &&
  !!activity.hash;

/**
 * The on-chain status of every Base withdraw request among `activities`, keyed
 * by the lowercased request transaction hash. A request missing from the map
 * has not been read yet, or could not be.
 *
 * A request still in the queue is re-read every minute. Once it has left the
 * queue it cannot change again, so it is never re-read.
 */
export function useBaseWithdrawRequests(
  activities: ActivityEvent[] | undefined,
): Record<string, BaseWithdrawRequest> {
  // Keyed on the joined hashes: the store hands over a new array on every
  // activity change, and the list of Base requests rarely changes with it.
  const hashKey = useMemo(() => {
    if (!isSoUsdBaseConfigured || !activities) return '';
    const unique = new Set<string>();
    for (const activity of activities) {
      if (activity && isBaseWithdrawRequest(activity)) unique.add(activity.hash.toLowerCase());
    }
    return [...unique].sort().join(',');
  }, [activities]);
  const hashes = useMemo(() => (hashKey ? hashKey.split(',') : []), [hashKey]);

  // Re-run only when a query's result changes or the set of requests does, so
  // the map keeps its identity between renders and useActivity's memo holds.
  const combine = useCallback(
    (results: QueryObserverResult<BaseWithdrawRequest | null>[]) => {
      const requests: Record<string, BaseWithdrawRequest> = {};
      results.forEach((result, i) => {
        if (result.data) requests[hashes[i]] = result.data;
      });
      return requests;
    },
    [hashes],
  );

  return useQueries({
    queries: hashes.map(hash => ({
      queryKey: [BASE_WITHDRAW_REQUEST, hash],
      queryFn: () => readBaseWithdrawRequest(hash as Hex),
      staleTime: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
        query.state.data && query.state.data.status !== 'pending' ? Infinity : PENDING_STALE_MS,
      refetchInterval: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
        query.state.data && query.state.data.status !== 'pending' ? false : PENDING_REFETCH_MS,
      retry: 2,
    })),
    combine,
  });
}
