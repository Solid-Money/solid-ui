import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTransfiOrder,
  getTransfiOrder,
  getTransfiPaymentConfig,
  getTransfiQuote,
  getTransfiStatus,
  shareTransfiKyc,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const TRANSFI_STATUS_KEY = 'transfiStatus';
export const TRANSFI_PAYMENT_CONFIG_KEY = 'transfiPaymentConfig';
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

/** Live quote for the entered USDC amount + selected payment method. */
export function useTransfiQuote(amount: string, paymentCode?: string, enabled = true) {
  const numeric = Number(amount);
  return useQuery({
    queryKey: [TRANSFI_QUOTE_KEY, amount, paymentCode],
    queryFn: () => withRefreshToken(() => getTransfiQuote(amount, paymentCode)),
    enabled: enabled && Number.isFinite(numeric) && numeric > 0,
    retry: 1,
  });
}

export function useCreateTransfiOrder() {
  return useMutation({
    mutationFn: async ({
      usdcAmount,
      paymentCode,
    }: {
      usdcAmount: string;
      paymentCode: string;
    }) => {
      const data = await withRefreshToken(() => createTransfiOrder(usdcAmount, paymentCode));
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
