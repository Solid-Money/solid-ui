import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getDetectedDirectDeposit } from '@/lib/api';
import { DetectedDirectDepositResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

const POLL_INTERVAL_MS = 4000;

type UseDetectedDirectDepositParams = {
  /** Poll only while the deposit-address screen is showing an address. */
  enabled: boolean;
  destinationType?: 'PROTOCOL' | 'RAIN_CARD';
  /** Fired once, with the activity's clientTxId, the first time a deposit shows up. */
  onDetected?: (deposit: DetectedDirectDepositResponse) => void;
};

/**
 * Watches the user's direct deposit address for an incoming transfer.
 *
 * The backend reports a deposit as soon as the (unconfirmed) webhook records it
 * — status `detected`, step `received` — so this fires at the earliest moment
 * the transfer is visible on chain, not when it finishes processing.
 */
export function useDetectedDirectDeposit({
  enabled,
  destinationType,
  onDetected,
}: UseDetectedDirectDepositParams) {
  // Pinned when watching starts so an older deposit never triggers a redirect.
  const [since, setSince] = useState(() => Date.now());
  const hasFiredRef = useRef(false);
  const wasEnabledRef = useRef(enabled);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Re-arm on every off→on transition (e.g. the user picked a different network),
  // but leave the mount-time `since` alone so the first poll is not thrown away.
  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      hasFiredRef.current = false;
      setSince(Date.now());
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  const { data } = useQuery({
    queryKey: ['detected-direct-deposit', since, destinationType],
    queryFn: () => withRefreshToken(() => getDetectedDirectDeposit(since, destinationType)),
    enabled,
    refetchInterval: query => (query.state.data?.detected ? false : POLL_INTERVAL_MS),
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!enabled || hasFiredRef.current) return;
    if (!data?.detected || !data.clientTxId) return;

    hasFiredRef.current = true;
    onDetectedRef.current?.(data);
  }, [enabled, data]);

  return { deposit: data, isDetected: !!data?.detected };
}
