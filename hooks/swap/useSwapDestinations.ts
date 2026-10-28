import { useQuery } from '@tanstack/react-query';

import { swapAssetKey } from '@/constants/swapChains';
import useUser from '@/hooks/useUser';
import { fetchLifiSwapDestinations } from '@/lib/api/lifi-swap';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';

/** The backend caches the route map for an hour; a few minutes here is plenty. */
const DESTINATIONS_STALE_MS = 5 * 60_000;

/**
 * What the "You pay" asset can be swapped into, as `chainId:address` keys, for
 * the "You get" picker. Null while it loads, when it fails, or when the backend
 * couldn't check routes: the picker then offers the whole swap list and the
 * quote has the last word, rather than showing nothing.
 */
export function useSwapDestinations(from: SwapAsset | undefined): ReadonlySet<string> | null {
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['swap-destinations', from && swapAssetKey(from)],
    enabled: !!user && !!from,
    queryFn: ({ signal }) =>
      withRefreshToken(() =>
        fetchLifiSwapDestinations({ fromChain: from!.chainId, fromToken: from!.address }, signal),
      ),
    staleTime: DESTINATIONS_STALE_MS,
    retry: 1,
  });

  if (!data || !data.routesChecked) return null;
  return new Set(
    data.destinations.map(token =>
      swapAssetKey({ chainId: token.chainId, address: token.address as SwapAsset['address'] }),
    ),
  );
}
