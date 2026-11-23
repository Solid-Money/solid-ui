import { useCallback } from 'react';

import { useSpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { ONE_USD } from '@/constants/cardSpendModule';
import { useBalancesRefresh } from '@/hooks/useBalances';
import { useCardCreditPositions } from '@/hooks/useCardCreditPositions';
import { useCardSpendable } from '@/hooks/useCardSpendable';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import { declinedPaymentFigures, withTileAvailable } from '@/lib/utils/cardCurrency';

import type { CardSpendableResponse, CardTransaction } from '@/lib/types';

/**
 * Live spending power for the declined receipt and its Home banner.
 *
 * What is available is the home Available to spend tile's own number, so the banner under the tile
 * and the receipt it opens quote the figure the tile shows — and neither says a payment is short
 * when the tile covers it. Nothing while the tile is still loading, so they do not show one number
 * and then another. When the tile cannot say (it reads "—"), the figures worked out here stand.
 *
 * The tile's cash comes from the token balances, not from the backend's spendable read, so the
 * poll and `refetchCash` re-read both: a top-up shows on the receipt at the poll's pace.
 */
export const useDeclineSpendable = ({
  enabled = true,
  refetchInterval,
}: { enabled?: boolean; refetchInterval?: number } = {}) => {
  const { registration, mode, position, isRegistered, isPaused, isLoading } =
    useCardSpendRegistration({
      refetchInterval: enabled ? refetchInterval : undefined,
    });
  const {
    data: cash,
    isLoading: isCashLoading,
    refetch: refetchSpendable,
  } = useCardSpendable({ enabled, refetchInterval });
  const { refetch: refetchBalances } = useBalancesRefresh({ enabled, refetchInterval });
  const refetchCash = useCallback(
    () => Promise.all([refetchSpendable(), refetchBalances()]),
    [refetchSpendable, refetchBalances],
  );
  const hasMode = enabled && !!registration;
  const { base, readsBase, isBaseGateReady } = useCardCreditPositions({
    enabled: hasMode && mode !== 'cash',
    refetchInterval,
  });
  const { inEuros, usdPerEur, toDisplayAmount } = useCardDisplayCurrency();
  const { availableUsd: tileUsd, isLoading: isTileLoading } = useSpendModeFigures();

  // One card authorization draws credit from one instance, subject to its remaining limits.
  const fuseMicroUsd =
    isRegistered && !isPaused && position?.fullyPriced !== false
      ? position?.availableToBorrowUsd
      : 0n;
  const baseMicroUsd = !readsBase || base.data === null ? 0n : base.data?.availableToBorrowUsd;
  const availableUsd =
    isBaseGateReady && fuseMicroUsd !== undefined && baseMicroUsd !== undefined
      ? Number(fuseMicroUsd > baseMicroUsd ? fuseMicroUsd : baseMicroUsd) / Number(ONE_USD)
      : undefined;

  const figuresFor = useCallback(
    (transaction: CardTransaction) => {
      if (!enabled || (!hasMode && isLoading)) return declinedPaymentFigures(transaction);
      const displayUsdPerEur = inEuros ? usdPerEur : undefined;
      if (tileUsd === null) {
        if (isTileLoading) return declinedPaymentFigures(transaction);
        if (!hasMode || mode === 'cash') return declinedPaymentFigures(transaction, cash);
        return declinedPaymentFigures(transaction, cash, { mode, availableUsd, displayUsdPerEur });
      }
      if (!hasMode || mode === 'cash') {
        // Still being read: wait for the card's own quote rather than show dollars and then euros.
        if (!cash && isCashLoading) return declinedPaymentFigures(transaction);
        // The read failed: the tile's number still stands, in dollars, with no card quote.
        const known: CardSpendableResponse = cash ?? {
          available: { amount: '0', currency: 'usd' },
        };
        const tileCash = withTileAvailable(known, {
          usd: tileUsd,
          eur: inEuros ? toDisplayAmount(tileUsd) : undefined,
        });
        return declinedPaymentFigures(transaction, tileCash);
      }
      return declinedPaymentFigures(transaction, cash, {
        mode,
        availableUsd: tileUsd,
        displayUsdPerEur,
        isTileFigure: true,
      });
    },
    [
      enabled,
      hasMode,
      isLoading,
      mode,
      cash,
      isCashLoading,
      availableUsd,
      inEuros,
      usdPerEur,
      toDisplayAmount,
      tileUsd,
      isTileLoading,
    ],
  );

  return { mode, figuresFor, refetchCash };
};
