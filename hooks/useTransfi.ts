import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTransfiOrder,
  getTransfiOrder,
  getTransfiPaymentConfig,
  getTransfiPaymentMethods,
  getTransfiQuote,
  getTransfiStatus,
  shareTransfiKyc,
} from '@/lib/api';
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

export function useTransfiPaymentConfig(enabled = true) {
  return useQuery({
    queryKey: [TRANSFI_PAYMENT_CONFIG_KEY],
    queryFn: () => withRefreshToken(() => getTransfiPaymentConfig()),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Payment methods for the selected fiat currency; refetches when it changes. */
export function useTransfiPaymentMethods(currency?: string) {
  return useQuery({
    queryKey: [TRANSFI_PAYMENT_METHODS_KEY, currency],
    queryFn: () => withRefreshToken(() => getTransfiPaymentMethods(currency as string)),
    enabled: Boolean(currency),
    staleTime: 60 * 1000,
  });
}

/** Live quote for the entered USDC amount + selected currency/payment method. */
export function useTransfiQuote(
  amount: string,
  currency?: string,
  paymentCode?: string,
  enabled = true,
) {
  const numeric = Number(amount);
  return useQuery({
    queryKey: [TRANSFI_QUOTE_KEY, amount, currency, paymentCode],
    queryFn: () => withRefreshToken(() => getTransfiQuote(amount, currency, paymentCode)),
    enabled: enabled && Boolean(currency) && Number.isFinite(numeric) && numeric > 0,
    retry: 1,
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
