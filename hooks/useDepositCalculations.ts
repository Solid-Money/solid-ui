import { useMemo } from 'react';

import { calculateOriginalDepositAmount, getEarliestDepositTimestamp } from '@/lib/financial';

export const useDepositCalculations = (
  userDepositTransactions: any,
  balance?: number,
  lastTimestamp?: number,
  decimals: number = 6,
) => {
  // Stabilize userDepositTransactions using JSON comparison
  // This prevents re-computation when React Query returns new object references
  // with identical data
  const transactionsKey = useMemo(
    () => JSON.stringify(userDepositTransactions ?? null),
    [userDepositTransactions],
  );

  const originalDepositAmount = useMemo(() => {
    if (!balance || balance <= 0) return 0;

    const calculated = calculateOriginalDepositAmount(userDepositTransactions, decimals);
    return calculated > 0 ? calculated : balance;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transactionsKey is intentional: stable JSON key replaces unstable object reference
  }, [transactionsKey, balance, decimals]);

  const firstDepositTimestamp = useMemo(() => {
    if (!balance || balance <= 0) return undefined;

    const fromSubgraph = getEarliestDepositTimestamp(userDepositTransactions, lastTimestamp);
    const now = Math.floor(Date.now() / 1000);

    let result: number | undefined;
    if (fromSubgraph && fromSubgraph > 0 && fromSubgraph <= now) {
      result = fromSubgraph;
    } else {
      result = lastTimestamp && lastTimestamp > 0 ? lastTimestamp : undefined;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionsKey, lastTimestamp, balance]);

  return {
    originalDepositAmount,
    firstDepositTimestamp,
  };
};
