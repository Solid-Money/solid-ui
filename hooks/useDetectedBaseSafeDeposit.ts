import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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

type DepositWatch = {
  userId: string;
  safeAddress: string;
  tokenAddress: string;
  since: number;
};

const matchesDeposit = (activity: ActivityEvent, watch: DepositWatch): boolean => {
  const tokenAddress = activity.metadata?.tokenAddress;
  const amount = Number(activity.amount);
  const timestamp = Number(activity.timestamp) * 1000;
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
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isFinite(timestamp) &&
    timestamp >= watch.since &&
    !getTransferContext(activity)
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
  const watch = useMemo<DepositWatch | undefined>(
    () =>
      isSelectedSafe && userId && safeAddress && tokenAddress
        ? { userId, safeAddress, tokenAddress, since: Date.now() }
        : undefined,
    [isSelectedSafe, userId, safeAddress, tokenAddress],
  );
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
      watch?.since,
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
