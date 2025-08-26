import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { calculateYield } from "@/lib/financial";
import { SavingMode } from "@/lib/types";

export const useCalculateSavings = (
  balance: number,
  apy: number,
  lastTimestamp: number,
  currentTime: number,
  mode: SavingMode = SavingMode.TOTAL,
) => {
  const [savings, setSavings] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const calculatedSavings = await calculateYield(balance, apy, lastTimestamp, currentTime, mode, queryClient);
      setSavings(calculatedSavings);
    })();
  }, [balance, apy, lastTimestamp, currentTime, mode, queryClient]);

  return { savings };
};
