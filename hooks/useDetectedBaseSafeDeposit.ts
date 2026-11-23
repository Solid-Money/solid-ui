import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseUnits } from 'viem';
import { base } from 'viem/chains';

import { WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';
import { constructActivity } from '@/lib/activityEvents';
import { fetchActivityEvents } from '@/lib/api';
import { type ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { getTransferContext } from '@/lib/utils/transferPresentation';
import { useActivityStore } from '@/store/useActivityStore';
import { selectIsRealtimeLive, useRealtimeStore } from '@/store/useRealtimeStore';
import { selectSelectedUser, useUserStore } from '@/store/useUserStore';

const POLL_INTERVAL_MS = 5000;
const LIVE_POLL_INTERVAL_MS = 15000;
const BASE_STABLECOIN_DECIMALS = 6;

type DepositWatch = {
  userId: string;
  safeAddress: string;
  tokenAddress: string;
  startedAt: number;
  knownHashes: ReadonlySet<string>;
};

const hasPositiveAmount = (amount: string): boolean => {
  try {
    return parseUnits(amount, BASE_STABLECOIN_DECIMALS) > 0n;
  } catch {
    return false;
  }
};

const matchesDeposit = (activity: ActivityEvent, watch: DepositWatch): boolean => {
  const tokenAddress = activity.metadata?.tokenAddress;
  const timestamp = Number(activity.timestamp);
  return (
    !activity.deleted &&
    activity.type === TransactionType.RECEIVE &&
    activity.status === TransactionStatus.SUCCESS &&
    !!activity.hash &&
    activity.chainId === base.id &&
    activity.toAddress?.toLowerCase() === watch.safeAddress &&
    !!activity.fromAddress &&
    activity.fromAddress.toLowerCase() !== watch.safeAddress &&
    typeof tokenAddress === 'string' &&
    tokenAddress.toLowerCase() === watch.tokenAddress &&
    Number.isFinite(timestamp) &&
    timestamp >= Math.floor(watch.startedAt / 1000) &&
    !watch.knownHashes.has(activity.hash.toLowerCase()) &&
    !getTransferContext(activity) &&
    hasPositiveAmount(activity.amount)
  );
};

const knownDepositHashes = (userId: string): ReadonlySet<string> => {
  const events = useActivityStore.getState().events[userId] ?? [];
  return new Set(
    events.flatMap(event =>
      event?.hash &&
      event.type === TransactionType.RECEIVE &&
      event.status === TransactionStatus.SUCCESS
        ? [event.hash.toLowerCase()]
        : [],
    ),
  );
};

/** Follow the confirmed wallet receipt, so it is already available when Activity opens. */
export function useDetectedBaseSafeDeposit({
  address,
  symbol,
  onDetected,
}: {
  address?: string;
  symbol?: 'USDC' | 'EURC';
  onDetected: () => void;
}) {
  const user = useUserStore(selectSelectedUser);
  const userId = user?.userId;
  const safeAddress = user?.safeAddress?.toLowerCase();
  const token = WALLET_DEPOSIT_TOKENS.find(token => token.symbol === symbol);
  const tokenAddress = token?.contracts[base.id]?.toLowerCase();
  const isSelectedSafe = !!address && address.toLowerCase() === safeAddress;
  const watch = useMemo<DepositWatch | undefined>(() => {
    if (!isSelectedSafe || !userId || !safeAddress || !tokenAddress) return undefined;

    return {
      userId,
      safeAddress,
      tokenAddress,
      startedAt: Date.now(),
      knownHashes: knownDepositHashes(userId),
    };
  }, [isSelectedSafe, userId, safeAddress, tokenAddress]);
  const firedWatch = useRef<DepositWatch>(undefined);

  const liveDeposit = useActivityStore(state =>
    watch
      ? state.events[watch.userId]?.find(event => event && matchesDeposit(event, watch))
      : undefined,
  );
  const isRealtimeLive = useRealtimeStore(selectIsRealtimeLive);
  const { data: polledDeposit } = useQuery({
    queryKey: [
      'base-safe-deposit',
      watch?.userId,
      watch?.safeAddress,
      watch?.tokenAddress,
      watch?.startedAt,
    ],
    queryFn: async () => {
      if (!watch) return null;
      const page = await withRefreshToken(() => fetchActivityEvents(1));
      return page?.docs.find(event => event && matchesDeposit(event, watch)) ?? null;
    },
    enabled: !!watch && !liveDeposit,
    refetchInterval: query =>
      query.state.data ? false : isRealtimeLive ? LIVE_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    gcTime: 0,
    retry: false,
    meta: { errorToast: false },
  });

  const deposit = liveDeposit ?? polledDeposit;
  useEffect(() => {
    if (!watch || !deposit || firedWatch.current === watch) return;
    const selected = selectSelectedUser(useUserStore.getState());
    if (
      selected?.userId !== watch.userId ||
      selected.safeAddress?.toLowerCase() !== watch.safeAddress
    ) {
      return;
    }

    firedWatch.current = watch;
    if (!liveDeposit) {
      useActivityStore
        .getState()
        .upsertEvent(watch.userId, constructActivity(deposit, watch.safeAddress));
    }
    onDetected();
  }, [deposit, liveDeposit, onDetected, watch]);

  return { isWatching: !!watch, isDetected: !!watch && !!deposit };
}
