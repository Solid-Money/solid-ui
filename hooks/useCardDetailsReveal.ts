import { revealCardDetailsComplete } from '@/lib/api';
import { CardDetailsRevealResponse } from '@/lib/types';
import { useCallback, useState } from 'react';

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
  const [cardDetails, setCardDetails] = useState<CardDetailsRevealResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revealDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const details = await revealCardDetailsComplete();
      setCardDetails(details);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal card details';
      setError(errorMessage);
      console.error('Card details reveal error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCardDetails = useCallback(() => {
    setCardDetails(null);
    setError(null);
  }, []);

  return {
    cardDetails,
    isLoading,
    error,
    revealDetails,
    clearCardDetails,
  };
};
