import { useCallback, useMemo } from 'react';
import { QueryObserverResult, useQueries } from '@tanstack/react-query';
import { Hex } from 'viem';
import { base } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { getStockVaultByShareSymbol, getStockVaultByTicker } from '@/constants/stockVaults';
import { getVaultKey } from '@/constants/withdraw';
import { hasInfoClientStocks } from '@/graphql/clients';
import useUser from '@/hooks/useUser';
import { isSoUsdBaseConfigured } from '@/lib/soUsdWithdraw';
import { BaseWithdrawRequest, readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';

export const BASE_WITHDRAW_REQUEST = 'baseWithdrawRequest';

/** How often a request still in the queue is re-read. Solves run every few hours. */
const PENDING_REFETCH_MS = 60_000;
/** Lets the many screens that mount useActivity share one read of a pending request. */
const PENDING_STALE_MS = 30_000;

/** soUSD's: an activity naming no vault is soUSD, as every withdraw was before vaults diverged. */
const isSoUsdWithdraw = (activity: ActivityEvent) =>
  (getVaultKey(activity.symbol) ?? 'USD') === 'USD';

/**
 * A withdraw request made on a Base queue this reads: soUSD's, or a stock vault's
 * own where this build has no stocks subgraph. Its transaction confirmed, so it is
 * in the queue or has left it.
 *
 * Not soEURC's: it withdraws on Base too, through its own queue, but its status
 * comes from the EUR subgraph (see useActivity) — as a stock vault's comes from the
 * stocks subgraph once there is one.
 */
export const isBaseWithdrawRequest = (
  activity: ActivityEvent,
): activity is ActivityEvent & {
  hash: string;
} =>
  activity.type === TransactionType.WITHDRAW &&
  activity.chainId === base.id &&
  (isSoUsdWithdraw(activity) ||
    (!hasInfoClientStocks() && !!getStockVaultByShareSymbol(activity.symbol))) &&
  activity.status === TransactionStatus.SUCCESS &&
  !!activity.hash;

/**
 * Reads one request: on soUSD's queue, or on its stock vault's, where how a finished
 * request ended is read from the queue's events too.
 */
const readRequest = (hash: Hex, ticker: string) => {
  const stock = getStockVaultByTicker(ticker);
  return stock
    ? readBaseWithdrawRequest(hash, stock.boringQueue, { readOutcome: true })
    : readBaseWithdrawRequest(hash);
};

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
  // Keyed on the joined hashes, each with its stock vault's ticker (none for
  // soUSD): the store hands over a new array on every activity change, and the list
  // of Base requests rarely changes with it. soUSD's requests only where this build
  // has its Base queue; the stock vaults' queues are the same in every build.
  const requestKey = useMemo(() => {
    if (!activities) return '';
    const unique = new Set<string>();
    for (const activity of activities) {
      if (!activity || !isBaseWithdrawRequest(activity)) continue;
      const ticker = getStockVaultByShareSymbol(activity.symbol)?.ticker ?? '';
      if (!ticker && !isSoUsdBaseConfigured) continue;
      unique.add(`${activity.hash.toLowerCase()}:${ticker}`);
    }
    return [...unique].sort().join(',');
  }, [activities]);
  const requests = useMemo(
    () => (requestKey ? requestKey.split(',').map(entry => entry.split(':')) : []),
    [requestKey],
  );
  const hashes = useMemo(() => requests.map(([hash]) => hash), [requests]);

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
    queries: requests.map(([hash, ticker]) => ({
      queryKey: [BASE_WITHDRAW_REQUEST, hash],
      queryFn: () => readRequest(hash as Hex, ticker),
      staleTime: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
        query.state.data && query.state.data.status !== 'pending' ? Infinity : PENDING_STALE_MS,
      refetchInterval: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
        query.state.data && query.state.data.status !== 'pending' ? false : PENDING_REFETCH_MS,
      retry: 2,
    })),
    combine,
  });
}

/** A soUSD withdrawal waiting in the Base queue: its shares have left the Safe, its USDC has not arrived. */
export type PendingWithdrawal = {
  clientTxId: string;
  /** Undefined if the request asked for something other than USDC. */
  amountUsd: number | undefined;
  /** Unix seconds, from the activity. */
  timestamp: string;
};

/**
 * The user's soUSD withdrawals still waiting in the Base queue, newest first, and
 * the USDC they will pay out.
 *
 * Between the request and the solve, which can take most of a day, the money is
 * neither savings (the queue holds the shares) nor wallet (no USDC yet). Without
 * this, every balance leaves it out and the user sees it vanish.
 *
 * A request not read yet is left out rather than guessed. Shares the user has
 * asked to withdraw but not yet requested are still in the Safe and counted there.
 */
export function usePendingBaseWithdrawals(): {
  withdrawals: PendingWithdrawal[];
  totalUsd: number;
} {
  const { user } = useUser();
  const activities = useActivityStore(
    useShallow(state => (user?.userId ? state.events[user.userId] : undefined)),
  );
  const requests = useBaseWithdrawRequests(activities);

  return useMemo(() => {
    const withdrawals: PendingWithdrawal[] = [];
    const seen = new Set<string>();
    for (const activity of activities ?? []) {
      // soUSD only: what a stock vault's request pays out is a stock, not USDC.
      if (!activity || !isBaseWithdrawRequest(activity) || !isSoUsdWithdraw(activity)) continue;
      const hash = activity.hash.toLowerCase();
      if (seen.has(hash)) continue;
      seen.add(hash);
      if (requests[hash]?.status !== 'pending') continue;
      withdrawals.push({
        clientTxId: activity.clientTxId,
        amountUsd: requests[hash].amountUsd,
        timestamp: activity.timestamp,
      });
    }
    withdrawals.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    const totalUsd = withdrawals.reduce((sum, item) => sum + (item.amountUsd ?? 0), 0);
    return { withdrawals, totalUsd };
  }, [activities, requests]);
}
