import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi } from 'viem';

import { publicClient } from '@/lib/wagmi';

const POLL_INTERVAL_MS = 6000;

type UseSafeTokenDepositParams = {
  /** Watch only while the deposit-address screen is showing the Safe. */
  enabled: boolean;
  chainId: number;
  /** The ERC-20 the screen asks for. A chain's own coin has no contract to read. */
  token?: string;
  /** The Safe the screen shows. */
  safe?: string;
  /** Fired once, the first time the balance rises above where it stood. */
  onReceived?: () => void;
};

/**
 * Watches the Safe's balance of one token for a deposit, from the moment its
 * address is shown.
 *
 * The deposit pipeline only watches the addresses it mints, and the Safe is not
 * one: a transfer straight to it is seen by nothing on our side until the
 * activity sync reads it from the chain. So this reads the chain itself. The
 * first balance read is the baseline; any later read above it is a deposit, and
 * polling stops there. A read below it (the Safe spent some meanwhile) becomes
 * the new baseline, so a deposit after a spend still counts.
 *
 * Each watch starts over: another token, another Safe, or the screen showing
 * the address again all take a fresh baseline, never one from an earlier visit.
 */
export function useSafeTokenDeposit({
  enabled,
  chainId,
  token,
  safe,
  onReceived,
}: UseSafeTokenDepositParams) {
  const watchKey =
    enabled && token && safe ? `${chainId}:${token}:${safe}`.toLowerCase() : undefined;
  // Each watch, a restart included, is a query of its own. A read still out when
  // a watch ends keeps its query in the cache until it lands, gcTime 0 or not; were
  // the next watch of the same token to share it, it would take that query's last
  // balance as its baseline, and the late read as a deposit.
  const mountId = useId();
  const [watch, setWatch] = useState({ key: watchKey, run: 0 });
  const run = watch.key === watchKey ? watch.run : watch.run + 1;
  if (watch.key !== watchKey) setWatch({ key: watchKey, run });
  const watchId = watchKey ? `${mountId}:${run}:${watchKey}` : undefined;

  const [receivedId, setReceivedId] = useState<string>();
  const isReceived = !!watchId && receivedId === watchId;
  const baselineRef = useRef<{ id?: string; balance?: bigint }>({});
  const onReceivedRef = useRef(onReceived);
  onReceivedRef.current = onReceived;

  const { data: balance } = useQuery({
    queryKey: ['safe-token-deposit', watchId],
    queryFn: () =>
      publicClient(chainId).readContract({
        address: token as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safe as Address],
      }),
    enabled: !!watchId && !isReceived,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  useEffect(() => {
    // A new watch, or none: nothing seen yet. (Nothing received either: what was
    // received belongs to the watch it was received on.)
    if (baselineRef.current.id !== watchId) baselineRef.current = { id: watchId };
    if (!watchId || balance === undefined || receivedId === watchId) return;

    const baseline = baselineRef.current.balance;
    if (baseline === undefined || balance < baseline) {
      baselineRef.current.balance = balance;
      return;
    }
    if (balance > baseline) {
      setReceivedId(watchId);
      onReceivedRef.current?.();
    }
  }, [watchId, balance, receivedId]);

  return { isWatching: !!watchId, isReceived };
}
