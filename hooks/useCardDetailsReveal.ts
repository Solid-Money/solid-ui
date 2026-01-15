import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { revealCardDetailsComplete } from '@/lib/api';
import { CardDetailsRevealResponse } from '@/lib/types';

export interface UseCardDetailsRevealReturn {
  cardDetails: CardDetailsRevealResponse | null;
  isLoading: boolean;
  error: string | null;
  revealDetails: () => Promise<void>;
  clearCardDetails: () => void;
}

/**
 * Hook for safely revealing card details using the Bridge API
 *
 * This hook implements the complete card details reveal flow:
 * - Generates a client secret and nonce
 * - Requests an ephemeral key from your backend
 * - Directly calls Bridge API to reveal card details
 *
 * Important: The revealed card details should NOT be stored persistently
 * and must be cleared from memory after use to comply with PCI DSS.
 */
export const useCardDetailsReveal = (): UseCardDetailsRevealReturn => {
  // Store card details in local state (not in React Query cache for PCI compliance)
  const [cardDetails, setCardDetails] = useState<CardDetailsRevealResponse | null>(null);

  const {
    mutateAsync,
    isPending: isLoading,
    error: mutationError,
    reset,
  } = useMutation({
    mutationFn: revealCardDetailsComplete,
    onSuccess: data => {
      setCardDetails(data);
    },
    onError: err => {
      console.error('Card details reveal error:', err);
    },
    // Don't retry on failure - user should explicitly retry
    retry: false,
  });

  const revealDetails = useCallback(async () => {
    await mutateAsync();
  }, [mutateAsync]);

  const clearCardDetails = useCallback(() => {
    setCardDetails(null);
    reset(); // Clear mutation error state as well
  }, [reset]);

  // Convert error to string format for backwards compatibility
  const error = mutationError
    ? mutationError instanceof Error
      ? mutationError.message
      : 'Failed to reveal card details'
    : null;

  return {
    cardDetails,
    isLoading,
    error,
    revealDetails,
    clearCardDetails,
  };
};
