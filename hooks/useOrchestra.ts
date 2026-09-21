import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import {
  createOrchestraOnramp,
  getOrchestraEstimate,
  getOrchestraLimits,
  getOrchestraRoutes,
  getOrchestraStatus,
  orchestraDestination,
} from '@/lib/api/orchestra';
import { OrchestraError } from '@/lib/orchestraErrors';
import { ORCHESTRA_SETTLED_STATUSES } from '@/lib/types/orchestra';

import type { OrchestraOnrampRequest } from '@/lib/types/orchestra';

export const ORCHESTRA_ROUTES_KEY = 'orchestraRoutes';
export const ORCHESTRA_LIMITS_KEY = 'orchestraLimits';
export const ORCHESTRA_ESTIMATE_KEY = 'orchestraEstimate';
export const ORCHESTRA_STATUS_KEY = 'orchestraStatus';

/** Orchestra's published fiat band, when it doesn't answer or doesn't say. */
export const ORCHESTRA_FALLBACK_MIN_USD = 1;
export const ORCHESTRA_FALLBACK_MAX_USD = 50000;

/** Docs: poll status every 3 seconds when the stream is unavailable. */
export const ORCHESTRA_POLL_INTERVAL_MS = 3000;

/**
 * Cadence once a live stream is carrying the transitions. The snapshot is still
 * needed — the stream frames carry only `{"status":"..."}`, and reconnects
 * don't replay what was missed — but at a heartbeat rather than a poll.
 */
export const ORCHESTRA_STREAM_BACKSTOP_INTERVAL_MS = 30000;

/**
 * Don't retry a refusal the server has already decided on. A 4xx here is a
 * verdict — an amount outside the route bounds, a disallowed origin, a rejected
 * read token — and more attempts only delay the screen that explains it.
 * Anything else gets one more go.
 */
const retryUnlessRefused = (failureCount: number, error: unknown) =>
  failureCount < 1 &&
  !(error instanceof OrchestraError && error.status >= 400 && error.status < 500);

/**
 * The destination asset's route entry, which is where its `decimals` come from.
 *
 * Every amount Orchestra returns is in smallest units, so without this the
 * screens can only show raw integers. Cached for an hour: an asset's exponent
 * does not change, and the rest of the entry changes slowly.
 */
export function useOrchestraDestinationAsset(enabled = true) {
  const { destinationChain, destinationAsset } = orchestraDestination();
  return useQuery({
    queryKey: [ORCHESTRA_ROUTES_KEY, destinationChain, destinationAsset],
    queryFn: async ({ signal }) => {
      const { assets } = await getOrchestraRoutes(signal);
      return assets.find(asset => asset.id === `${destinationChain}:${destinationAsset}`) ?? null;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Amount bounds for the Lightning → destination route.
 *
 * Operator-tuned and changed without notice, so it is fetched rather than
 * hardcoded — but cached for five minutes, because the band moves far more
 * slowly than a user types.
 */
export function useOrchestraLimits(enabled = true) {
  return useQuery({
    queryKey: [ORCHESTRA_LIMITS_KEY],
    queryFn: ({ signal }) => getOrchestraLimits(signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Indicative pricing for the entered USD amount.
 *
 * Pass a debounced amount — every distinct value is a separate request. The
 * queryFn consumes react-query's AbortSignal so a superseded estimate (the user
 * typed another digit) is cancelled rather than left in flight. The previous
 * estimate is kept as placeholder data so the breakdown doesn't collapse
 * between keystrokes; callers check `isFetching` before trusting it for the
 * current input.
 */
export function useOrchestraEstimate(amountUsd: string, enabled = true) {
  const numeric = Number(amountUsd);
  return useQuery({
    queryKey: [ORCHESTRA_ESTIMATE_KEY, amountUsd],
    queryFn: ({ signal }) => getOrchestraEstimate(amountUsd, signal),
    enabled: enabled && Number.isFinite(numeric) && numeric > 0,
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
  });
}

/**
 * Create the order and its invoice.
 *
 * Not retried: /onramp allocates a real invoice, and a retry without reusing
 * the original idempotency key would strand a second one. The screen turns the
 * failure into the error step instead.
 */
export function useCreateOrchestraOnramp() {
  return useMutation({
    mutationFn: (request: Omit<OrchestraOnrampRequest, 'destinationChain' | 'destinationAsset'>) =>
      createOrchestraOnramp(request),
    retry: false,
  });
}

/**
 * One order's snapshot, polled.
 *
 * This is the fallback path and the source of truth for everything the stream
 * doesn't carry — amounts, stages, `errorCode`. `useOrchestraOrderStream` passes
 * `poll: false` once a live stream is up, which drops this to the slow backstop
 * instead of stopping it.
 *
 * Polling stops on its own once the order settles. `unfulfilled` is not settled:
 * a late deposit can still resume it, so it keeps being read.
 *
 * A 404 is not an error here: /status has nothing to return until the Lightning
 * payment is detected, which is most of this screen's life. It is surfaced as
 * `order: null` and the poll continues.
 */
export function useOrchestraOrderStatus(
  orderId: string | undefined,
  readToken: string | undefined,
  options?: { poll?: boolean },
) {
  const poll = options?.poll ?? true;
  return useQuery({
    queryKey: [ORCHESTRA_STATUS_KEY, orderId],
    queryFn: async ({ signal }) => {
      try {
        return await getOrchestraStatus(orderId as string, readToken as string, signal);
      } catch (error) {
        if (error instanceof OrchestraError && error.status === 404) {
          return { order: null };
        }
        throw error;
      }
    },
    enabled: Boolean(orderId && readToken),
    refetchInterval: query => {
      const status = query.state.data?.order?.status;
      if (status && ORCHESTRA_SETTLED_STATUSES.includes(status)) return false;
      // A refusal does not become true by being asked again. `retry` already
      // declines to repeat a 4xx, but the interval is independent of it — an
      // expired read token would otherwise have this firing the same rejected
      // request every three seconds for as long as the screen is open, straight
      // into the rate limiter.
      const error = query.state.error;
      if (error instanceof OrchestraError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return poll ? ORCHESTRA_POLL_INTERVAL_MS : ORCHESTRA_STREAM_BACKSTOP_INTERVAL_MS;
    },
    retry: retryUnlessRefused,
  });
}
