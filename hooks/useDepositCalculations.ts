import { useMemo } from "react";

import {
  calculateOriginalDepositAmount,
  getEarliestDepositTimestamp
} from "@/lib/financial";

export const useDepositCalculations = (
  userDepositTransactions: any,
  balance?: number,
  lastTimestamp?: number
) => {
  const originalDepositAmount = useMemo(() => {
    if (!balance || balance <= 0) return 0;

    const calculated = calculateOriginalDepositAmount(userDepositTransactions);
    return calculated > 0 ? calculated : balance;
  }, [userDepositTransactions, balance]);

  const firstDepositTimestamp = useMemo(() => {
    if (!balance || balance <= 0) return undefined;

    const timestamp = getEarliestDepositTimestamp(userDepositTransactions, lastTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (timestamp && timestamp > 0 && timestamp <= now) {
      return timestamp;
    }

    return lastTimestamp && lastTimestamp > 0 ? lastTimestamp : undefined;
  }, [userDepositTransactions, lastTimestamp, balance]);

  return {
    originalDepositAmount,
    firstDepositTimestamp,
  };
};
