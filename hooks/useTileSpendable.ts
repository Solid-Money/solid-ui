import { useMemo } from 'react';

import { useSpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { useCardSpendable } from '@/hooks/useCardSpendable';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import { withTileAvailable } from '@/lib/utils/cardCurrency';

/**
 * {@link useCardSpendable} with the home Available to spend tile's number as what is available.
 *
 * What the declined-payment banner and its receipt read, so they say the same figure as the tile
 * above them. The backend's own figure counts cash only, and in Credit mode the tile counts the
 * credit line. See `withTileAvailable`.
 *
 * Nothing while the tile is still loading, so the banner does not show one number and then
 * another. When the tile cannot say (it reads "—"), the backend's figure stands.
 */
export const useTileSpendable = (options: Parameters<typeof useCardSpendable>[0] = {}) => {
  const { data: spendable, refetch } = useCardSpendable(options);
  const { availableUsd, isLoading } = useSpendModeFigures();
  const { inEuros, toDisplayAmount } = useCardDisplayCurrency();

  const data = useMemo(() => {
    if (!spendable) return undefined;
    if (availableUsd === null) return isLoading ? undefined : spendable;
    return withTileAvailable(spendable, {
      usd: availableUsd,
      eur: inEuros ? toDisplayAmount(availableUsd) : undefined,
    });
  }, [spendable, availableUsd, isLoading, inEuros, toDisplayAmount]);

  return { data, refetch };
};

export default useTileSpendable;
