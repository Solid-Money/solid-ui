import { useMutation, useQuery } from '@tanstack/react-query';

import { createWalletTopUpQuote, getWalletTopUp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { isWalletTopUpSettled } from '@/lib/walletTopUp';

import type { WalletTopUpQuoteRequest } from '@/lib/types/wallet-topup';

export const WALLET_TOPUP_STATUS_QUERY_KEY = 'walletTopUpStatus';

/** How often the status step asks where the top-up is. */
export const WALLET_TOPUP_POLL_INTERVAL_MS = 3000;

/**
 * Price a top-up and mint the checkout token for it.
 *
 * Not retried: every call mints a fresh token and estimate, so a retry is the
 * user's to make. Re-arming after a quote expires calls this again.
 */
export const useCreateWalletTopUpQuote = () =>
  useMutation({
    mutationFn: (body: WalletTopUpQuoteRequest) =>
      withRefreshToken(() => createWalletTopUpQuote(body)),
  });

/**
 * Where a top-up is, polled every few seconds until it settles — completed,
 * failed, expired, or held for review. The backend refreshes from Wirex on the
 * way, so polling here is all the status step needs.
 */
export const useWalletTopUpStatus = (estimationId: string | null | undefined) =>
  useQuery({
    queryKey: [WALLET_TOPUP_STATUS_QUERY_KEY, estimationId],
    queryFn: () => withRefreshToken(() => getWalletTopUp(estimationId!)),
    enabled: !!estimationId,
    refetchInterval: query =>
      isWalletTopUpSettled(query.state.data?.status) ? false : WALLET_TOPUP_POLL_INTERVAL_MS,
    // A missed poll is made up by the next one.
    retry: false,
    staleTime: 0,
  });
