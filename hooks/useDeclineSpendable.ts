import { useCallback } from 'react';

import { ONE_USD } from '@/constants/cardSpendModule';
import { useCardCreditPositions } from '@/hooks/useCardCreditPositions';
import { useCardSpendable } from '@/hooks/useCardSpendable';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import { declinedPaymentFigures } from '@/lib/utils/cardCurrency';

import type { CardTransaction } from '@/lib/types';

/** Live spending power for the declined receipt and its Home banner. */
export const useDeclineSpendable = ({
  enabled = true,
  refetchInterval,
}: { enabled?: boolean; refetchInterval?: number } = {}) => {
  const { registration, mode, position, isRegistered, isPaused } = useCardSpendRegistration({
    refetchInterval: enabled ? refetchInterval : undefined,
  });
  const { data: cash, refetch: refetchCash } = useCardSpendable({ enabled, refetchInterval });
  const hasMode = enabled && !!registration;
  const { base, readsBase, isBaseGateReady } = useCardCreditPositions({
    enabled: hasMode && mode !== 'cash',
    refetchInterval,
  });
  const { inEuros, usdPerEur } = useCardDisplayCurrency();

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
      if (!hasMode) return declinedPaymentFigures(transaction);
      if (mode === 'cash') return declinedPaymentFigures(transaction, cash);
      return declinedPaymentFigures(transaction, cash, {
        mode,
        availableUsd,
        displayUsdPerEur: inEuros ? usdPerEur : undefined,
      });
    },
    [hasMode, mode, cash, availableUsd, inEuros, usdPerEur],
  );

  return { mode, figuresFor, refetchCash };
};
