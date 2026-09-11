import { useQuery } from '@tanstack/react-query';

import { createDirectDepositSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

import type { OnramperAsset } from '@/lib/types';

export const ONRAMPER_DESTINATION_KEY = 'onramperDestination';

/**
 * Where an Onramper purchase should actually be delivered.
 *
 * Emphatically *not* the user's Safe. The Safe is deployed on Fuse; on Ethereum
 * or Base that same address is an undeployed contract nobody controls. Worse,
 * the deposit webhook matches incoming transfers against registered
 * direct-deposit addresses only (`findByAddress(toAddress)`), and the Safe is
 * never registered on an EVM stream — so a delivery there is not detected, not
 * bridged, and never appears in the app. The money would simply be gone.
 *
 * A direct-deposit session mints the address the pipeline is watching for this
 * chain and token, which is the same mechanism behind "deposit from an external
 * wallet". Onramper is just another sender as far as that pipeline is concerned.
 *
 * Keyed by chain and symbol so switching networks re-mints rather than reusing
 * an address that belongs to a different chain.
 */
export default function useOnramperDestination(asset?: OnramperAsset) {
  return useQuery({
    queryKey: [ONRAMPER_DESTINATION_KEY, asset?.chainId ?? null, asset?.code ?? null],
    queryFn: () =>
      withRefreshToken(() =>
        createDirectDepositSession(asset?.chainId as number, asset?.code as string),
      ),
    enabled: Boolean(asset?.chainId && asset?.code),
    // Sessions expire. Re-minting on focus would be worse than holding one —
    // the address is stable per user and destination — but a stale session must
    // not outlive its window, so this is refetched rather than cached forever.
    staleTime: 60 * 1000,
    retry: 1,
  });
}
