import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { fetchOnramperAssets, fetchOnramperConfig } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const ONRAMPER_CONFIG_KEY = 'onramperConfig';
export const ONRAMPER_ASSETS_KEY = 'onramperAssets';

/** Onramper's catalogue barely moves; our backend caches it too. */
const CATALOGUE_STALE_TIME = 10 * 60 * 1000;

/**
 * Normalizes the empty string and undefined to one value.
 *
 * The country arrives as `''` before geo resolves and as `undefined` from
 * callers that omit it. Left alone they would be two cache keys for the same
 * question, and the availability gate and the amount screen would each fetch
 * their own copy.
 */
const key = (value?: string) => value || null;

/**
 * Fiat currencies the buy flow offers, which to preselect, and — the part the
 * entry point turns on — whether a buy can complete from `country` at all.
 *
 * `enabled` exists so the platform check can come first: off iOS there is no
 * checkout button to render whatever this says, so the call is not worth making.
 */
export function useOnramperConfig(country?: string, enabled = true) {
  return useQuery({
    queryKey: [ONRAMPER_CONFIG_KEY, key(country)],
    queryFn: () => withRefreshToken(() => fetchOnramperConfig(country || undefined)),
    enabled,
    staleTime: CATALOGUE_STALE_TIME,
    retry: 1,
  });
}

/**
 * Assets we can buy with `source` and deliver into the user's Safe, plus the
 * payment methods available in `country`.
 *
 * An empty `assets` is a real answer, not an absence — it is how a country
 * nothing prices for reports itself — so callers must distinguish it from
 * `isLoading` rather than treating both as "nothing yet".
 */
export function useOnramperAssets(source?: string, country?: string) {
  const { user } = useUser();
  const wallet = user?.safeAddress;

  return useQuery({
    queryKey: [ONRAMPER_ASSETS_KEY, key(source), key(country), key(wallet)],
    queryFn: () =>
      withRefreshToken(() => fetchOnramperAssets(source as string, country || undefined, wallet)),
    enabled: Boolean(source),
    staleTime: CATALOGUE_STALE_TIME,
    retry: 1,
  });
}
