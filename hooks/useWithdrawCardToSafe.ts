import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { withdrawCardToSafeAddress } from '@/lib/api';
import { Status } from '@/lib/types';

function truncateToTwoDecimals(value: string): string {
  const num = parseFloat(value);
  const truncated = Math.floor(num * 100) / 100;
  return truncated.toFixed(2);
}

export const useWithdrawCardToSafe = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async (amount: string, clientNote?: string) => {
    setStatus(Status.PENDING);
    setError(null);

    try {
      const truncatedAmount = truncateToTwoDecimals(amount);
      await withdrawCardToSafeAddress({ amount: truncatedAmount, clientNote });
      setStatus(Status.SUCCESS);

      // Invalidate card details to refresh balance and withdrawals list
      queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
      queryClient.invalidateQueries({ queryKey: ['cardWithdrawals'] });
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      const message = err?.message || 'Withdrawal failed';
      setError(message);
      setStatus(Status.ERROR);
      throw err;
    }
  };

  return {
    withdraw,
    status,
    error,
    isPending: status === Status.PENDING,
    isSuccess: status === Status.SUCCESS,
    isError: status === Status.ERROR,
  };
};
