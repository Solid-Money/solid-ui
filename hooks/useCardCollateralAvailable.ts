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
 *
 * `tokens` lists every collateral asset the card holds. Spending power is
 * credited against all of them, but a withdrawal moves one named asset, so the
 * screen has to let the user pick: a card funded in USDT cannot be emptied
 * through a USDC withdrawal.
 *
 * @param tokenAddress open on a specific asset; omit for the richest one.
 */
export function useCardCollateralAvailable(tokenAddress?: string) {
  const { provider } = useCardProvider();

  return useQuery({
    queryKey: [CARD_COLLATERAL_AVAILABLE_KEY, tokenAddress ?? null],
    queryFn: () => withRefreshToken(() => getCardCollateralAvailable({ tokenAddress })),
    enabled: provider === CardProvider.RAIN,
    // Collateral moves when deposits settle and when charges are swept, so the
    // withdraw screen re-reads it on the same cadence as the card balance.
    refetchInterval: 5000,
    // Switching asset re-queries; keeping the last result avoids the amount
    // field flashing back to a skeleton mid-edit.
    placeholderData: previous => previous,
    retry: 2,
  });
}
