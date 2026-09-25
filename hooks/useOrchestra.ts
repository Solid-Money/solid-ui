import { useMutation, useQuery } from '@tanstack/react-query';

import { createOrchestraOnramp, getOrchestraConfig, getOrchestraStatus } from '@/lib/api/orchestra';
import { OrchestraError } from '@/lib/orchestraErrors';
import { ORCHESTRA_SETTLED_STATUSES } from '@/lib/types/orchestra';
import { withRefreshToken } from '@/lib/utils';

export const ORCHESTRA_CONFIG_KEY = 'orchestraConfig';
export const ORCHESTRA_STATUS_KEY = 'orchestraStatus';

/** Docs: poll status every 3 seconds when the stream is unavailable. */
export const ORCHESTRA_POLL_INTERVAL_MS = 3000;

/**
 * Cadence once a live stream is carrying the transitions. The snapshot is still
 * needed — stream frames carry only the status, and reconnects don't replay
 * what was missed — but at a heartbeat rather than a poll.
 */
export const ORCHESTRA_STREAM_BACKSTOP_INTERVAL_MS = 30000;

/**
 * Don't retry a refusal the server has already decided on. A 4xx here is a
 * verdict — an amount outside the route bounds, a wallet that isn't ready, an
 * order that isn't yours — and more attempts only delay the screen that
 * explains it. Anything else gets one more go.
 */
const retryUnlessRefused = (failureCount: number, error: unknown) =>
  failureCount < 1 &&
  !(error instanceof OrchestraError && error.status >= 400 && error.status < 500);

/**
 * Where the deposit lands, how its amounts scale, and the band it has to fall
 * in — one call, so the amount screen renders whole or not at all.
 *
 * Doubles as the availability check: the backend answers 503 when it has no
 * Orchestra server key, which is how the entry point knows not to offer the
 * deposit method at all.
 */
export function useOrchestraConfig(countryCode?: string, enabled = true) {
  return useQuery({
    // Keyed on the country: the audience answer changes with it, and a cached
    // "no" from before geo resolved would outlive the reason for it.
    queryKey: [ORCHESTRA_CONFIG_KEY, countryCode],
    queryFn: ({ signal }) => withRefreshToken(() => getOrchestraConfig(countryCode, signal)),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryUnlessRefused,
  });
}

/**
 * Create the order and its invoice.
 *
 * Not retried: it allocates a real invoice, and a second attempt strands the
 * first. The screen turns the failure into the error step instead.
 */
export function useCreateOrchestraOnramp() {
  return useMutation({
    mutationFn: ({ amountFiatUsd, countryCode }: { amountFiatUsd: string; countryCode?: string }) =>
      withRefreshToken(() => createOrchestraOnramp(amountFiatUsd, countryCode)),
    retry: false,
  });
}

/**
 * One order's snapshot, polled.
 *
 * The fallback path, and the source of truth for everything the stream doesn't
 * carry — amounts, stages, `errorCode`. `useOrchestraOrderStream` passes
 * `poll: false` once a live stream is up, which drops this to the slow backstop
 * rather than stopping it.
 *
 * Polling stops on its own once the order settles. `unfulfilled` is not
 * settled: a late deposit can still resume it, so it keeps being read.
 */
export function useOrchestraOrderStatus(orderId: string | undefined, options?: { poll?: boolean }) {
  const poll = options?.poll ?? true;
  return useQuery({
    queryKey: [ORCHESTRA_STATUS_KEY, orderId],
    queryFn: ({ signal }) => withRefreshToken(() => getOrchestraStatus(orderId as string, signal)),
    enabled: Boolean(orderId),
    refetchInterval: query => {
      const status = query.state.data?.order?.status;
      if (status && ORCHESTRA_SETTLED_STATUSES.includes(status)) return false;
      // A refusal does not become true by being asked again, and the interval
      // is independent of `retry` — without this an unauthorised or expired
      // read would fire every three seconds for as long as the screen is open.
      const error = query.state.error;
      if (error instanceof OrchestraError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return poll ? ORCHESTRA_POLL_INTERVAL_MS : ORCHESTRA_STREAM_BACKSTOP_INTERVAL_MS;
    },
    retry: retryUnlessRefused,
  });
}
