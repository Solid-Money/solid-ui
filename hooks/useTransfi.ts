import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeTransfiProfile,
  createTransfiOrder,
  getTransfiOrder,
  getTransfiPaymentConfig,
  getTransfiPaymentMethods,
  getTransfiQuote,
  getTransfiStatus,
  retryTransfiKyc,
  shareTransfiKyc,
  upgradeTransfiKyc,
} from '@/lib/api';
import { TransfiError } from '@/lib/transfiErrors';
import { TransfiKycLevel, TransfiProfileInput } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export const TRANSFI_STATUS_KEY = 'transfiStatus';
export const TRANSFI_PAYMENT_CONFIG_KEY = 'transfiPaymentConfig';
export const TRANSFI_PAYMENT_METHODS_KEY = 'transfiPaymentMethods';
export const TRANSFI_QUOTE_KEY = 'transfiQuote';
export const TRANSFI_ORDER_KEY = 'transfiOrder';

/**
 * Buy-crypto gating status. Poll while KYC is pending so the UI advances when
 * TransFi finishes verifying the shared documents.
 */
export function useTransfiStatus(options?: { enabled?: boolean; poll?: boolean }) {
  return useQuery({
    queryKey: [TRANSFI_STATUS_KEY],
    queryFn: () => withRefreshToken(() => getTransfiStatus()),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.poll ? 5000 : false,
    retry: 1,
  });
}

export function useShareTransfiKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await withRefreshToken(() => shareTransfiKyc());
      if (!data) throw new Error('Failed to share KYC with TransFi');
      return data;
    },
    onSuccess: data => {
      queryClient.setQueryData([TRANSFI_STATUS_KEY], data);
    },
  });
}

/**
 * Ask TransFi for a hosted KYC link after a rejected share.
 *
 * The response is also a gating status, so it is written straight into the
 * status cache: when TransFi refuses the retry (already submitted, terminally
 * rejected) the screen re-renders from that instead of the stale `rejected`.
 */
export function useRetryTransfiKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await withRefreshToken(() => retryTransfiKyc());
      if (!data) throw new Error('Failed to start the TransFi verification');
      return data;
    },
    onSuccess: ({ kycUrl: _kycUrl, ...status }) => {
      queryClient.setQueryData([TRANSFI_STATUS_KEY], status);
    },
  });
}

/**
 * Ask TransFi for its verification page for the next KYC level, after an order
 * breached the limits of the current one.
 *
 * Nothing is written to the status cache: the user stays `ready` whatever
 * TransFi answers, because they can still buy within their current limits.
 */
export function useUpgradeTransfiKyc() {
  return useMutation({
    mutationFn: async (level: TransfiKycLevel) => {
      const data = await withRefreshToken(() => upgradeTransfiKyc(level));
      if (!data) throw new Error('Failed to start the TransFi verification');
      return data;
    },
  });
}

/**
 * Send the address/phone the user filled in, then re-share their KYC.
 *
 * The response is the refreshed gating status, so it replaces the cached one —
 * the pending screen and the entry point both read from there, and leaving the
 * pre-share status behind would send the user back to the same dead end.
 */
export function useCompleteTransfiProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: TransfiProfileInput) => {
      const data = await withRefreshToken(() => completeTransfiProfile(profile));
      if (!data) throw new Error('Failed to save your details');
      return data;
    },
    onSuccess: data => {
      queryClient.setQueryData([TRANSFI_STATUS_KEY], data);
    },
  });
}

/**
 * Don't retry a refusal the server has already decided on. A 4xx here is a
 * verdict — an unsupported region, an amount outside the limits — and three
 * more attempts only delay the screen that explains it.
 */
const retryUnlessRefused = (failureCount: number, error: unknown) =>
  failureCount < 1 && !(error instanceof TransfiError && error.status >= 400 && error.status < 500);

export function useTransfiPaymentConfig(enabled = true) {
  return useQuery({
    queryKey: [TRANSFI_PAYMENT_CONFIG_KEY],
    queryFn: () => withRefreshToken(() => getTransfiPaymentConfig()),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryUnlessRefused,
  });
}

/** Payment methods for the selected fiat currency; refetches when it changes. */
export function useTransfiPaymentMethods(currency?: string) {
  return useQuery({
    queryKey: [TRANSFI_PAYMENT_METHODS_KEY, currency],
    queryFn: () => withRefreshToken(() => getTransfiPaymentMethods(currency as string)),
    enabled: Boolean(currency),
    staleTime: 60 * 1000,
    retry: retryUnlessRefused,
  });
}

/**
 * Live quote for the entered USDC amount + selected currency/payment method.
 *
 * Pass a debounced amount — every distinct value is a separate request to
 * TransFi. The queryFn consumes react-query's AbortSignal so a superseded quote
 * (the user typed another digit) is cancelled rather than left in flight to
 * resolve after the one we actually want.
 *
 * The previous quote is kept as placeholder data so the breakdown doesn't
 * collapse between keystrokes; callers must check `usdcAmount` on the result
 * before trusting it for the current input (see TransfiAmount).
 */
export function useTransfiQuote(
  amount: string,
  currency?: string,
  paymentCode?: string,
  enabled = true,
) {
  const numeric = Number(amount);
  return useQuery({
    queryKey: [TRANSFI_QUOTE_KEY, amount, currency, paymentCode],
    queryFn: ({ signal }) =>
      withRefreshToken(() => getTransfiQuote(amount, currency, paymentCode, signal)),
    enabled: enabled && Boolean(currency) && Number.isFinite(numeric) && numeric > 0,
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
  });
}

export function useCreateTransfiOrder() {
  return useMutation({
    mutationFn: async ({
      usdcAmount,
      paymentCode,
      currency,
    }: {
      usdcAmount: string;
      paymentCode: string;
      currency?: string;
    }) => {
      const data = await withRefreshToken(() =>
        createTransfiOrder(usdcAmount, paymentCode, currency),
      );
      if (!data) throw new Error('Failed to create TransFi order');
      return data;
    },
  });
}

/** Poll an order's status until it settles or fails. */
export function useTransfiOrder(orderId?: string, poll = true) {
  return useQuery({
    queryKey: [TRANSFI_ORDER_KEY, orderId],
    queryFn: () => withRefreshToken(() => getTransfiOrder(orderId as string)),
    enabled: Boolean(orderId),
    refetchInterval: query => {
      if (!poll) return false;
      const phase = query.state.data?.phase;
      return phase === 'completed' || phase === 'failed' ? false : 5000;
    },
  });
}
