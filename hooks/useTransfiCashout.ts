import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import {
  createTransfiCashoutOrder,
  getTransfiCashoutConfig,
  getTransfiCashoutOrder,
  getTransfiCashoutPaymentMethods,
  getTransfiCashoutQuote,
  submitTransfiCashoutDeposit,
} from '@/lib/api';
import { TransfiError } from '@/lib/transfiErrors';
import { withRefreshToken } from '@/lib/utils';

export const TRANSFI_CASHOUT_CONFIG_KEY = 'transfiCashoutConfig';
export const TRANSFI_CASHOUT_METHODS_KEY = 'transfiCashoutMethods';
export const TRANSFI_CASHOUT_QUOTE_KEY = 'transfiCashoutQuote';
export const TRANSFI_CASHOUT_ORDER_KEY = 'transfiCashoutOrder';

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
  const numeric = Number(amount);
  return useQuery({
    queryKey: [TRANSFI_CASHOUT_QUOTE_KEY, amount, currency, paymentCode],
    queryFn: ({ signal }) =>
      withRefreshToken(() =>
        getTransfiCashoutQuote(amount, currency as string, paymentCode as string, signal),
      ),
    enabled:
      enabled &&
      Boolean(currency) &&
      Boolean(paymentCode) &&
      Number.isFinite(numeric) &&
      numeric > 0,
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
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
