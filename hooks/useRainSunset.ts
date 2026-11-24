import { useQuery } from '@tanstack/react-query';

import { useCardStatus } from '@/hooks/useCardStatus';
import { getCardCollateralAvailable } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { holdsClosingCard, rainSunsetOf } from '@/lib/utils/rainSunset';

export const RAIN_SUNSET_BALANCE_KEY = 'rainSunsetBalance';

/**
 * Rain sunset for the signed-in user: the closing-card block from
 * `/cards/status`, and the balance still on the closing card.
 *
 * The balance is the card's on-chain collateral summed over every token — the
 * same read the withdraw screen uses, because that is what can actually be
 * moved to the wallet. Read only for someone still holding the closing card,
 * or whose card the sunset closed (what was left on it is still theirs), and
 * on a slow cadence: this backs a banner, not a form.
 */
export function useRainSunset() {
  const { data: cardStatus, isLoading: isStatusLoading } = useCardStatus();
  const sunset = rainSunsetOf(cardStatus);
  const holdsCard = holdsClosingCard(sunset);

  const balance = useQuery({
    queryKey: [RAIN_SUNSET_BALANCE_KEY],
    queryFn: () => withRefreshToken(() => getCardCollateralAvailable({})),
    enabled: holdsCard,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    cardStatus,
    sunset,
    isLoading: isStatusLoading,
    /** Total balance left on the closing card, in dollars; null until read. */
    balanceUsd: holdsCard ? (balance.data?.totalCollateralUsd ?? null) : 0,
    collateral: balance.data ?? null,
    isBalanceLoading: balance.isLoading,
    refetchBalance: balance.refetch,
  };
}
