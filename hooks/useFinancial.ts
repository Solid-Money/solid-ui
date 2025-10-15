import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const queryClient = useQueryClient();

  // Memoize the calculation parameters to prevent unnecessary recalculations
  const calculationParams = useMemo(
    () => ({
      balance,
      apy,
      lastTimestamp,
      currentTime,
      mode,
      userDepositTransactions,
      safeAddress,
    }),
    [balance, apy, lastTimestamp, currentTime, mode, userDepositTransactions, safeAddress],
  );

  // Memoize the calculation function
  const calculateSavings = useCallback(async () => {
    const calculatedSavings = await calculateYield(
      calculationParams.balance,
      calculationParams.apy,
      calculationParams.lastTimestamp,
      calculationParams.currentTime,
      calculationParams.mode,
      queryClient,
      calculationParams.userDepositTransactions,
      calculationParams.safeAddress,
    );
    setSavings(calculatedSavings);
  }, [calculationParams, queryClient]);

  useEffect(() => {
    calculateSavings();
  }, [calculateSavings]);

  return { savings };
};
