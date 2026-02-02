import { useEffect, useMemo, useRef } from 'react';

import { calculateOriginalDepositAmount, getEarliestDepositTimestamp } from '@/lib/financial';

export const useDepositCalculations = (
  userDepositTransactions: any,
  balance?: number,
  lastTimestamp?: number,
  decimals: number = 6,
) => {
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

  const originalDepositAmount = useMemo(() => {
    if (!balance || balance <= 0) return 0;

    const calculated = calculateOriginalDepositAmount(transactionsRef.current, decimals);
    return calculated > 0 ? calculated : balance;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transactionsKey is intentional: stable JSON key replaces unstable object reference
  }, [transactionsKey, balance, decimals]);

  const firstDepositTimestamp = useMemo(() => {
    if (!balance || balance <= 0) return undefined;

    const timestamp = getEarliestDepositTimestamp(transactionsRef.current, lastTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (timestamp && timestamp > 0 && timestamp <= now) {
      return timestamp;
    }

    return lastTimestamp && lastTimestamp > 0 ? lastTimestamp : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transactionsKey is intentional: stable JSON key replaces unstable object reference
  }, [transactionsKey, lastTimestamp, balance]);

  return {
    originalDepositAmount,
    firstDepositTimestamp,
  };
};
