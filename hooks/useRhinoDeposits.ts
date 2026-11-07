import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getRhinoDeposits } from '@/lib/api';
import { isTerminalRhinoStatus, pickRhinoDeposit } from '@/lib/rhinoDeposit';
import { withRefreshToken } from '@/lib/utils';

const POLL_INTERVAL_MS = 5000;

type UseRhinoDepositsParams = {
  /** Poll only while the screen is showing a rhino.fi address. */
  enabled: boolean;
  depositAddress?: string;
  /** rhino.fi chain id, e.g. `TRON`. */
  chain?: string;
  addressType?: string;
};

/**
 * Watches a rhino.fi deposit address for a transfer, modelled on
 * `useDetectedDirectDeposit`.
 *
 * `since` is pinned when the address is shown, so a deposit from an earlier
 * visit never surfaces here. Polling stops once the deposit reaches a state
 * rhino.fi will not move it on from (executed, rejected or refunded). An
 * executed payout lands at the user's Solid destination, where the regular
 * deposit pipeline and the activity feed report it — this hook does not follow
 * it any further.
 */
export function useRhinoDeposits({
  enabled: enabledParam,
  depositAddress,
  chain,
  addressType,
}: UseRhinoDepositsParams) {
  const enabled = enabledParam && !!depositAddress && !!chain && !!addressType;
  const [since, setSince] = useState(() => Date.now());
  const wasEnabledRef = useRef(enabled);

  // Re-arm on every off→on transition (another chain was picked and its address
  // has just arrived), but leave the mount-time `since` alone.
  useEffect(() => {
    if (enabled && !wasEnabledRef.current) setSince(Date.now());
    wasEnabledRef.current = enabled;
  }, [enabled]);

  const match = useMemo(
    () =>
      depositAddress && chain && addressType ? { depositAddress, chain, addressType } : undefined,
    [depositAddress, chain, addressType],
  );

  const { data } = useQuery({
    queryKey: ['rhino-deposits', since],
    queryFn: () => withRefreshToken(() => getRhinoDeposits(since)),
    enabled,
    refetchInterval: query => {
      const deposit = match ? pickRhinoDeposit(query.state.data?.deposits, match) : undefined;
      return deposit && isTerminalRhinoStatus(deposit.status) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    meta: { errorToast: false },
  });

  const deposit = useMemo(
    () => (enabled && match ? pickRhinoDeposit(data?.deposits, match) : undefined),
    [data, enabled, match],
  );

  return { deposit };
}
