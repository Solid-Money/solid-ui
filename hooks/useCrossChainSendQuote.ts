import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseUnits } from 'viem';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { CrossChainSendApiError, fetchCrossChainSendQuote } from '@/lib/api/cross-chain-send';
import { CrossChainSendToken } from '@/lib/types/cross-chain-send';
import { withRefreshToken } from '@/lib/utils';
import { CROSS_CHAIN_SEND_DECIMALS } from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

type Params = {
  token: CrossChainSendToken | null;
  dstChainId: number | null;
  /** Human amount as typed ("100.5"). */
  amount: string;
  enabled?: boolean;
  /** Debounce before a new amount is priced; the Review step passes 0. */
  debounceMs?: number;
  /** Re-price on an interval (the Review step every 30s). */
  refetchInterval?: number | false;
};

/** "100.5" → "100500000", or null when the amount isn't a positive number. */
export const toAmountLD = (amount: string): string | null => {
  if (!amount || isNaN(Number(amount))) return null;
  try {
    const wei = parseUnits(amount, CROSS_CHAIN_SEND_DECIMALS);
    return wei > 0n ? wei.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Price a cross-chain send. Keyed by token/network/amount so the Form and the
 * Review step share one cache entry, and mirrored into the send store so the
 * execute hook authorises against the numbers the user last saw.
 */
export const useCrossChainSendQuote = ({
  token,
  dstChainId,
  amount,
  enabled = true,
  debounceMs = 400,
  refetchInterval = false,
}: Params) => {
  const setCrossChainQuote = useSendStore(state => state.setCrossChainQuote);
  const [debouncedAmount, setDebouncedAmount] = useState(amount);

  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedAmount(amount);
      return;
    }
    const handle = setTimeout(() => setDebouncedAmount(amount), debounceMs);
    return () => clearTimeout(handle);
  }, [amount, debounceMs]);

  const amountLD = toAmountLD(debouncedAmount);
  const isEnabled = enabled && !!token && dstChainId !== null && amountLD !== null;

  const query = useQuery({
    queryKey: ['cross-chain-send', 'quote', token, dstChainId, amountLD],
    queryFn: async () => {
      const quote = await withRefreshToken(() =>
        fetchCrossChainSendQuote({ token: token!, dstChainId: dstChainId!, amountLD: amountLD! }),
      );
      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_QUOTED, {
        token,
        dst_chain_id: dstChainId,
        amount_ld: amountLD,
        amount_received_ld: quote.amountReceivedLD,
        total_fee_ld: quote.totalFeeLD,
        eta_minutes: quote.etaMinutes,
      });
      return quote;
    },
    enabled: isEnabled,
    staleTime: 20 * 1000,
    refetchInterval,
    retry: (failureCount, error) =>
      // A 4xx carries a message for the user (below minimum, feature paused):
      // retrying won't change the answer.
      !(error instanceof CrossChainSendApiError && error.status < 500) && failureCount < 2,
  });

  useEffect(() => {
    setCrossChainQuote(query.data ?? null);
  }, [query.data, setCrossChainQuote]);

  /** True while the typed amount is waiting for the debounce or the request. */
  const isPending = isEnabled && (query.isLoading || query.isFetching) && !query.data;
  const isDebouncing = enabled && !!token && dstChainId !== null && amount !== debouncedAmount;

  const errorMessage =
    query.error instanceof CrossChainSendApiError
      ? query.error.message
      : query.error
        ? "Couldn't get a quote. Please try again."
        : null;

  return {
    quote: query.data ?? null,
    amountLD,
    isLoading: isPending || isDebouncing,
    isFetching: query.isFetching,
    errorMessage,
    refetch: query.refetch,
  };
};

export default useCrossChainSendQuote;
