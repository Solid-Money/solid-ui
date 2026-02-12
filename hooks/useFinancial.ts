import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

export const useCalculateSavings = (
  balance: number,
  apy: number,
  lastTimestamp: number,
  currentTime: number,
  mode: SavingMode = SavingMode.TOTAL_USD,
  userDepositTransactions?: any,
  safeAddress?: string,
) => {
  const [savings, setSavings] = useState<number | undefined>(undefined);

  // Stabilize userDepositTransactions reference using JSON comparison
  // This prevents infinite re-renders when React Query returns new object references
  // with identical data
  const transactionsRef = useRef(userDepositTransactions);
  const transactionsKey = useMemo(
    () => JSON.stringify(userDepositTransactions ?? null),
    [userDepositTransactions],
  );

  // Update ref only when actual data changes (not just reference)
  useEffect(() => {
    transactionsRef.current = userDepositTransactions;
  }, [transactionsKey, userDepositTransactions]);

  // Memoize the calculation parameters using stable primitive values
  const calculationParams = useMemo(
    () => ({
      balance,
      apy,
      lastTimestamp,
      currentTime,
      mode,
      safeAddress,
    }),
    [balance, apy, lastTimestamp, currentTime, mode, safeAddress],
  );

  // Memoize the calculation function - use transactionsKey for stability
  const calculateSavings = useCallback(async () => {
    const calculatedSavings = await calculateYield(
      calculationParams.balance,
      calculationParams.apy,
      calculationParams.lastTimestamp,
      calculationParams.currentTime,
      calculationParams.mode,
      transactionsRef.current,
      calculationParams.safeAddress,
    );
    setSavings(calculatedSavings);
  }, [calculationParams]);

  useEffect(() => {
    calculateSavings();
  }, [calculateSavings]);

  return { savings };
};
