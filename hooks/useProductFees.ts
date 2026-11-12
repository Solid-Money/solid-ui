import { useMutation, useQuery } from '@tanstack/react-query';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';

import { fetchFeePromotions, fetchProductFeeRates, recordSwapFee } from '@/lib/api';
import { FeeProduct, RecordSwapFeeParams } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { eurDepositPromotion } from '@/lib/utils/feePromotion';
import { useUserStore } from '@/store/useUserStore';

const PRODUCT_FEES = 'productFees';

// Same reason the rewards hooks key by user id: these endpoints are
// authenticated purely by the session and carry no address in the URL, so every
// account would otherwise share one cache entry and a wallet switch would serve
// the previous account's fee rates to the new one.
const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

/**
 * The product fee rates the signed-in user currently pays.
 *
 * Cached briefly rather than per-session: a user who stakes FUSE for Ultra
 * should stop being quoted a fee within a minute, not on next launch. The swap
 * flow reads the rate from here to size its fee, so a stale rate is a fee that
 * disagrees with what the backend expects.
 */
export const useProductFeeRates = () => {
  const userId = useSelectedUserId();

  return useQuery({
    queryKey: [PRODUCT_FEES, 'rates', userId],
    queryFn: async () => withRefreshToken(() => fetchProductFeeRates()),
    staleTime: secondsToMilliseconds(60),
    gcTime: minutesToMilliseconds(5),
    // Only meaningful for a signed-in user; an anonymous session has no tier.
    enabled: Boolean(userId),
  });
};

/**
 * The fee promotions running for this user — what the euro account screen
 * reads to say their next SEPA deposits are free.
 *
 * Short-lived like the rates: a promotion an admin switches off should stop
 * being advertised within a minute, and a deposit that used a free slot should
 * bring the count down by the time the user looks again.
 */
export const useFeePromotions = () => {
  const userId = useSelectedUserId();

  return useQuery({
    queryKey: [PRODUCT_FEES, 'promotions', userId],
    queryFn: async () => withRefreshToken(() => fetchFeePromotions()),
    staleTime: secondsToMilliseconds(60),
    gcTime: minutesToMilliseconds(5),
    enabled: Boolean(userId),
  });
};

/**
 * The promotion making this user's next SEPA deposits to the euro account
 * free, or null — none running, none left, or not loaded yet. A failed load
 * reads as none: the screen then simply doesn't advertise it.
 */
export const useEurDepositPromotion = () => {
  const { data } = useFeePromotions();
  return eurDepositPromotion(data ?? null);
};

/**
 * The swap fee rate for this user, and where the fee must be sent.
 *
 * Both come back undefined until the rates load, and `buildSwapFeeTransfer`
 * treats either being missing as "collect nothing" — so a swap during the first
 * moments of a session, or against a backend that has no revenue wallet
 * configured, runs fee-free rather than failing or paying a guessed address.
 */
export const useSwapFeeRate = () => {
  const { data, isLoading } = useProductFeeRates();

  return {
    rate: data?.rates?.[FeeProduct.SWAP],
    revenueWalletAddress: data?.revenueWalletAddress,
    tierName: data?.tierName,
    isLoading,
  };
};

/**
 * Report a collected swap fee to the backend.
 *
 * Fire-and-forget from the caller's point of view: the fee is already on chain
 * by the time this runs, so a failed report is a bookkeeping gap to be
 * backfilled, never a reason to fail the swap the user just completed.
 */
export const useRecordSwapFee = () =>
  useMutation({
    mutationFn: async (params: RecordSwapFeeParams) =>
      withRefreshToken(() => recordSwapFee(params)),
  });
