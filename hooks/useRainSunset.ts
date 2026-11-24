import { useQuery } from '@tanstack/react-query';

import { useCardStatus } from '@/hooks/useCardStatus';
import { getCardCollateralAvailable } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { closingCardBalanceUsd, rainSunsetOf } from '@/lib/utils/rainSunset';

export const RAIN_SUNSET_BALANCE_KEY = 'rainSunsetBalance';

/**
 * Rain sunset for the signed-in user: the closing-card block from
 * `/cards/status`, and the balance still on the closing card.
 *
 * The balance is what is still the cardholder's own money: the card's on-chain
 * collateral, capped at its spending power (`closingCardBalanceUsd`). The part
 * of the collateral that pays for card payments already made is not theirs to
 * withdraw, so it is never quoted as a balance. Read only for someone still
 * holding the closing card, and on a slow cadence: this backs a banner, not a
 * form.
 */
export function useRainSunset() {
  const { data: cardStatus, isLoading: isStatusLoading } = useCardStatus();
  const sunset = rainSunsetOf(cardStatus);

  const balance = useQuery({
    queryKey: [RAIN_SUNSET_BALANCE_KEY],
    queryFn: () => withRefreshToken(() => getCardCollateralAvailable({})),
    enabled: Boolean(sunset?.hasRainCard),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    cardStatus,
    sunset,
    isLoading: isStatusLoading,
    /** What the cardholder can still withdraw from the closing card, in dollars; null until read. */
    balanceUsd: sunset?.hasRainCard ? closingCardBalanceUsd(balance.data) : 0,
    collateral: balance.data ?? null,
    isBalanceLoading: balance.isLoading,
    refetchBalance: balance.refetch,
  };
}
