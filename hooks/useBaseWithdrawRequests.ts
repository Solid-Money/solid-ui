import { useCallback, useMemo } from 'react';
import { QueryObserverResult, useQueries } from '@tanstack/react-query';
import { type Address, formatUnits, Hex, isAddressEqual } from 'viem';
import { base, mainnet } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { getVaultKey, type VaultKey } from '@/constants/withdraw';
import { useBtcPriceQuery } from '@/hooks/useBtcPriceUsd';
import { useNativePriceQuery } from '@/hooks/useNativePriceUsd';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { isSoBtcConfigured, SOBTC_ADDRESSES, SOBTC_DECIMALS } from '@/lib/soBtc';
import { isSoEthBaseConfigured } from '@/lib/soEthWithdraw';
import { isSoUsdBaseConfigured } from '@/lib/soUsdWithdraw';
import { BaseWithdrawRequest, readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';

export const BASE_WITHDRAW_REQUEST = 'baseWithdrawRequest';

/** How often a request still in the queue is re-read. Solves run every few hours. */
const PENDING_REFETCH_MS = 60_000;
/** Lets the many screens that mount useActivity share one read of a pending request. */
const PENDING_STALE_MS = 30_000;

/**
 * A soUSD, soETH or soBTC withdraw request made on its Base queue, or a soBTC one on its Ethereum
 * queue (the WBTC route): its transaction confirmed, so it is in the queue or has left it. Both
 * soBTC queues track requests on-chain, so neither needs a subgraph.
 *
 * soEURC withdraws on Base too, but its status comes from the EUR subgraph (see
 * useActivity). An activity naming no vault is soUSD, as every withdraw was
 * before vaults diverged.
 */
export const isBaseWithdrawRequest = (
  activity: ActivityEvent,
): activity is ActivityEvent & {
  hash: string;
} => {
  if (
    activity.type !== TransactionType.WITHDRAW ||
    activity.status !== TransactionStatus.SUCCESS ||
    !activity.hash
  ) {
    return false;
  }
  const vault = getVaultKey(activity.symbol) ?? 'USD';
  if (activity.chainId === mainnet.id) return vault === 'BTC' && isSoBtcConfigured;
  if (activity.chainId !== base.id) return false;
  return (
    (vault === 'USD' && isSoUsdBaseConfigured) ||
    (vault === 'ETH' && isSoEthBaseConfigured) ||
    (vault === 'BTC' && isSoBtcConfigured)
  );
};

/** The queue a request from {@link isBaseWithdrawRequest} was made on. */
const baseWithdrawQueueOf = (activity: ActivityEvent) => {
  const vault = getVaultKey(activity.symbol);
  if (vault === 'ETH') return ADDRESSES.base.soEthBoringQueue;
  if (vault === 'BTC') {
    return activity.chainId === mainnet.id
      ? SOBTC_ADDRESSES.ethereum.boringQueue
      : SOBTC_ADDRESSES.base.boringQueue;
  }
  return ADDRESSES.base.boringQueue;
};

/**
 * Where a Base request lives in {@link useBaseWithdrawRequests}' map: its transaction hash and the
 * queue it was read from, lowercased, so a soUSD and a soETH request can never share an entry.
 */
export const baseWithdrawRequestKey = (activity: ActivityEvent & { hash: string }) =>
  `${activity.hash.toLowerCase()}@${baseWithdrawQueueOf(activity).toLowerCase()}`;

/**
 * The on-chain status of every Base withdraw request among `activities`, keyed
 * by {@link baseWithdrawRequestKey} (hash and queue). A request missing from the map
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
  // Each entry is "hash@queue": a soETH request is read from the soETH queue.
  const hashKey = useMemo(() => {
    if (!activities) return '';
    const unique = new Set<string>();
    for (const activity of activities) {
      if (activity && isBaseWithdrawRequest(activity)) {
        unique.add(baseWithdrawRequestKey(activity));
      }
    }
    return [...unique].sort().join(',');
  }, [activities]);
  const keys = useMemo(() => (hashKey ? hashKey.split(',') : []), [hashKey]);

  // Re-run only when a query's result changes or the set of requests does, so
  // the map keeps its identity between renders and useActivity's memo holds.
  const combine = useCallback(
    (results: QueryObserverResult<BaseWithdrawRequest | null>[]) => {
      const requests: Record<string, BaseWithdrawRequest> = {};
      results.forEach((result, i) => {
        if (result.data) requests[keys[i]] = result.data;
      });
      return requests;
    },
    [keys],
  );

  return useQueries({
    queries: keys.map(key => {
      const [hash, queue] = key.split('@');
      return {
        queryKey: [BASE_WITHDRAW_REQUEST, hash, queue],
        queryFn: () =>
          readBaseWithdrawRequest(
            hash as Hex,
            queue as Address,
            // soBTC's Ethereum queue is the only one not on Base.
            isAddressEqual(queue as Address, SOBTC_ADDRESSES.ethereum.boringQueue)
              ? mainnet.id
              : base.id,
          ),
        staleTime: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
          query.state.data && query.state.data.status !== 'pending' ? Infinity : PENDING_STALE_MS,
        refetchInterval: (query: { state: { data?: BaseWithdrawRequest | null } }) =>
          query.state.data && query.state.data.status !== 'pending' ? false : PENDING_REFETCH_MS,
        retry: 2,
      };
    }),
    combine,
  });
}

/**
 * A soUSD or soETH withdrawal waiting in its Base queue: its shares have left the Safe, its USDC
 * or WETH has not arrived.
 */
export type PendingWithdrawal = {
  clientTxId: string;
  /** Which vault it leaves, so a product screen lists only its own. */
  vault: Extract<VaultKey, 'USD' | 'ETH' | 'BTC'>;
  /**
   * In dollars: the USDC paid out, the WETH at the ETH price, or the cbBTC at the BTC price.
   * Undefined until both are known.
   */
  amountUsd: number | undefined;
  /** Unix seconds, from the activity. */
  timestamp: string;
};

/**
 * The dollar value of `amount` base units of an asset with `decimals` at `priceUsd`, in fixed
 * point: the price is taken to micro-dollars and multiplied in bigint, so only the final figure
 * becomes a float, for display and totals. WETH (18 decimals) and cbBTC/WBTC (8).
 */
const assetUsd = (amount: string, decimals: number, priceUsd: number): number => {
  const microUsdPerUnit = BigInt(Math.round(priceUsd * 1e6));
  return Number(formatUnits((BigInt(amount) * microUsdPerUnit) / 10n ** BigInt(decimals), 6));
};

/**
 * The user's soUSD and soETH withdrawals still waiting in their Base queues, newest
 * first, and what they will pay out in dollars (soETH's WETH at the ETH price).
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
  // Shared with the portfolio's ETH price, so it is one cached read.
  const hasEthRequest = (activities ?? []).some(
    activity =>
      !!activity && isBaseWithdrawRequest(activity) && getVaultKey(activity.symbol) === 'ETH',
  );
  const { data: ethPriceData } = useNativePriceQuery(mainnet.id, 'ethPriceUsd', hasEthRequest);
  const ethPrice = Number(ethPriceData) || undefined;
  const hasBtcRequest = (activities ?? []).some(
    activity =>
      !!activity && isBaseWithdrawRequest(activity) && getVaultKey(activity.symbol) === 'BTC',
  );
  const { data: btcPriceData } = useBtcPriceQuery(hasBtcRequest);
  const btcPrice = Number(btcPriceData) || undefined;

  return useMemo(() => {
    const withdrawals: PendingWithdrawal[] = [];
    const seen = new Set<string>();
    for (const activity of activities ?? []) {
      if (!activity || !isBaseWithdrawRequest(activity)) continue;
      const key = getVaultKey(activity.symbol);
      const vault = key === 'ETH' || key === 'BTC' ? key : 'USD';
      const requestKey = baseWithdrawRequestKey(activity);
      if (seen.has(requestKey)) continue;
      seen.add(requestKey);
      if (requests[requestKey]?.status !== 'pending') continue;
      const { amountUsd, amountWethWei, amountBtcSats } = requests[requestKey];
      withdrawals.push({
        clientTxId: activity.clientTxId,
        vault,
        amountUsd:
          vault === 'ETH'
            ? amountWethWei !== undefined && ethPrice
              ? assetUsd(amountWethWei, 18, ethPrice)
              : undefined
            : vault === 'BTC'
              ? amountBtcSats !== undefined && btcPrice
                ? assetUsd(amountBtcSats, SOBTC_DECIMALS, btcPrice)
                : undefined
              : amountUsd,
        timestamp: activity.timestamp,
      });
    }
    withdrawals.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    const totalUsd = withdrawals.reduce((sum, item) => sum + (item.amountUsd ?? 0), 0);
    return { withdrawals, totalUsd };
  }, [activities, requests, ethPrice, btcPrice]);
}
