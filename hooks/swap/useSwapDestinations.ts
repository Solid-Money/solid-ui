import { useQuery } from '@tanstack/react-query';

import { swapAssetKey } from '@/constants/swapChains';
import useUser from '@/hooks/useUser';
import { fetchLifiSwapDestinations } from '@/lib/api/lifi-swap';
import { FetchTimeoutError } from '@/lib/fetchWithTimeout';
import { LifiSwapDestinations, SwapAsset } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';

/** The backend caches the route map for an hour; a few minutes here is plenty. */
const DESTINATIONS_STALE_MS = 5 * 60_000;

const toReachable = (data: LifiSwapDestinations): ReadonlySet<string> | null =>
  data.routesChecked && Array.isArray(data.destinations)
    ? new Set(
        data.destinations.map(token =>
          swapAssetKey({ chainId: token.chainId, address: token.address as SwapAsset['address'] }),
        ),
      )
    : null;

/**
 * What the "You pay" asset can be swapped into, as `chainId:address` keys.
 * Undefined while the first check is loading. Null when there is no checked
 * list, so the picker can fall back to the swap list and let the quote decide.
 *
 * Asked for a Fuse coin too: off Fuse the backend lists only the coins a
 * sponsored swap can deliver, since LI.FI's route map lists far more.
 */
export function useSwapDestinations(
  from: SwapAsset | undefined,
): ReadonlySet<string> | null | undefined {
  const { user } = useUser();
  const { data, isLoading } = useQuery({
    queryKey: ['swap-destinations', from && swapAssetKey(from)],
    enabled: !!user && !!from,
    queryFn: ({ signal }) =>
      withRefreshToken(() =>
        fetchLifiSwapDestinations({ fromChain: from!.chainId, fromToken: from!.address }, signal),
      ),
    staleTime: DESTINATIONS_STALE_MS,
    retry: (failureCount, error) => failureCount < 1 && !(error instanceof FetchTimeoutError),
    select: toReachable,
  });

  return isLoading ? undefined : (data ?? null);
}
