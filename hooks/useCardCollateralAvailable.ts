import { useQuery } from '@tanstack/react-query';

import { getCardCollateralAvailable } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

import { useCardProvider } from './useCardProvider';

const CARD_COLLATERAL_AVAILABLE_KEY = 'cardCollateralAvailable';

/**
 * How much collateral the user can actually withdraw from their card, read
 * from the collateral proxy on-chain by the backend.
 *
 * The card's spending balance (`useCardDetails`) is Rain's credit-side
 * spending power and can exceed the collateral backing it, so it must not be
 * used as the maximum on the withdraw-to-wallet screen — a withdrawal above
 * the on-chain balance is rejected once the user has already committed to it.
 */
export function useCardCollateralAvailable() {
  const { provider } = useCardProvider();

  return useQuery({
    queryKey: [CARD_COLLATERAL_AVAILABLE_KEY],
    queryFn: () => withRefreshToken(() => getCardCollateralAvailable()),
    enabled: provider === CardProvider.RAIN,
    // Collateral moves when deposits settle and when charges are swept, so the
    // withdraw screen re-reads it on the same cadence as the card balance.
    refetchInterval: 5000,
    retry: 2,
  });
}
