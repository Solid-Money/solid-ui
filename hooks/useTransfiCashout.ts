import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createTransfiCashoutOrder,
  getTransfiCashoutConfig,
  getTransfiCashoutLimits,
  getTransfiCashoutOrder,
  getTransfiCashoutPaymentMethods,
  getTransfiCashoutQuote,
  submitTransfiCashoutDeposit,
} from '@/lib/api';
import { limitsFromError } from '@/lib/cashoutLimits';
import { TransfiError } from '@/lib/transfiErrors';
import { withRefreshToken } from '@/lib/utils';

import type { TransfiCashoutLimits, TransfiCashoutQuote } from '@/lib/types';

export const TRANSFI_CASHOUT_CONFIG_KEY = 'transfiCashoutConfig';
export const TRANSFI_CASHOUT_METHODS_KEY = 'transfiCashoutMethods';
export const TRANSFI_CASHOUT_LIMITS_KEY = 'transfiCashoutLimits';
export const TRANSFI_CASHOUT_QUOTE_KEY = 'transfiCashoutQuote';
export const TRANSFI_CASHOUT_ORDER_KEY = 'transfiCashoutOrder';

/** How long a payout method's limits are trusted before they are asked for again. */
const LIMITS_STALE_MS = 5 * 60 * 1000;

/** A 4xx is the server's verdict; retrying it only delays the screen that explains it. */
const retryUnlessRefused = (failureCount: number, error: unknown) =>
  failureCount < 1 && !(error instanceof TransfiError && error.status >= 400 && error.status < 500);

export function useTransfiCashoutConfig(enabled = true) {
  return useQuery({
    queryKey: [TRANSFI_CASHOUT_CONFIG_KEY],
    queryFn: () => withRefreshToken(() => getTransfiCashoutConfig()),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryUnlessRefused,
  });
}

/**
 * Payout methods for a currency, each carrying the fields it needs. Kept fresh
 * for a minute only: the field rules come straight from TransFi, and a stale
 * rule is a payout refused after the user has already sent.
 */
export function useTransfiCashoutPaymentMethods(currency?: string) {
  return useQuery({
    queryKey: [TRANSFI_CASHOUT_METHODS_KEY, currency],
    queryFn: () => withRefreshToken(() => getTransfiCashoutPaymentMethods(currency as string)),
    enabled: Boolean(currency),
    staleTime: 60 * 1000,
    retry: retryUnlessRefused,
  });
}

export const cashoutLimitsKey = (currency?: string, paymentCode?: string) => [
  TRANSFI_CASHOUT_LIMITS_KEY,
  currency,
  paymentCode,
];

/**
 * TransFi's USDC limits for one payout method — they differ per method, so
 * they are cached per method, and fetched as soon as one is chosen rather than
 * after a quote is refused. Trusted for five minutes, and refreshed sooner by
 * every quote that states them (see cashoutQuoteQuery).
 */
export function useTransfiCashoutLimits(currency?: string, paymentCode?: string) {
  return useQuery({
    queryKey: cashoutLimitsKey(currency, paymentCode),
    queryFn: () =>
      withRefreshToken(() => getTransfiCashoutLimits(currency as string, paymentCode as string)),
    enabled: Boolean(currency) && Boolean(paymentCode),
    staleTime: LIMITS_STALE_MS,
    retry: retryUnlessRefused,
  });
}

/**
 * The quote query, shared by the live quote and the fresh one fetched on
 * Review. Every response that states limits — a quote, or a refusal of an
 * out-of-range amount — writes them into the limits cache, restarting its five
 * minutes, so the screen always checks against the newest limits it has seen.
 */
export const cashoutQuoteQuery = (
  queryClient: QueryClient,
  amount: string,
  currency?: string,
  paymentCode?: string,
) => ({
  queryKey: [TRANSFI_CASHOUT_QUOTE_KEY, amount, currency, paymentCode],
  queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<TransfiCashoutQuote> => {
    const rememberLimits = (limits?: Partial<TransfiCashoutLimits>) => {
      if (limits?.minLimit == null || limits.maxLimit == null) return;
      queryClient.setQueryData<TransfiCashoutLimits>(cashoutLimitsKey(currency, paymentCode), {
        minLimit: limits.minLimit,
        maxLimit: limits.maxLimit,
      });
    };
    try {
      const quote = await withRefreshToken(() =>
        getTransfiCashoutQuote(amount, currency as string, paymentCode as string, signal),
      );
      rememberLimits(quote);
      return quote;
    } catch (error) {
      rememberLimits(limitsFromError(error));
      throw error;
    }
  },
  retry: retryUnlessRefused,
});

/**
 * Live quote for a (debounced) USDC amount. Keeps the previous quote while the
 * next loads; callers must compare `usdcAmount` before trusting it.
 */
export function useTransfiCashoutQuote(
  amount: string,
  currency?: string,
  paymentCode?: string,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const numeric = Number(amount);
  return useQuery({
    ...cashoutQuoteQuery(queryClient, amount, currency, paymentCode),
    enabled:
      enabled &&
      Boolean(currency) &&
      Boolean(paymentCode) &&
      Number.isFinite(numeric) &&
      numeric > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateTransfiCashoutOrder() {
  return useMutation({
    mutationFn: (body: Parameters<typeof createTransfiCashoutOrder>[0]) =>
      withRefreshToken(() => createTransfiCashoutOrder(body)),
  });
}

export function useSubmitTransfiCashoutDeposit() {
  return useMutation({
    mutationFn: ({ orderId, txHash }: { orderId: string; txHash: string }) =>
      withRefreshToken(() => submitTransfiCashoutDeposit(orderId, txHash)),
    // The transfer is already on-chain by now; recording its hash is for
    // support, so a blip here is worth a couple of quiet retries.
    retry: 2,
  });
}

/** Poll a cash-out until it settles, fails or expires. */
export function useTransfiCashoutOrder(orderId?: string, poll = true) {
  return useQuery({
    queryKey: [TRANSFI_CASHOUT_ORDER_KEY, orderId],
    queryFn: () => withRefreshToken(() => getTransfiCashoutOrder(orderId as string)),
    enabled: Boolean(orderId),
    refetchInterval: query => {
      if (!poll) return false;
      const phase = query.state.data?.phase;
      return phase === 'completed' || phase === 'failed' || phase === 'expired' ? false : 5000;
    },
  });
}
