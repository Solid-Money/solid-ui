import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { DUMMY_CARD_REVEAL, isDummyUserId } from '@/constants/dummyCard';
import { useWalletMessageSigner } from '@/hooks/useWalletMessageSigner';
import { revealCardDetailsComplete } from '@/lib/api';
import { CardDetailsRevealResponse, CardProvider } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

export interface UseCardDetailsRevealReturn {
  cardDetails: CardDetailsRevealResponse | null;
  isLoading: boolean;
  error: string | null;
  revealDetails: () => Promise<void>;
  clearCardDetails: () => void;
}

/**
 * Hook for safely revealing card details.
 *
 * Neither issuer lets a plaintext card number pass through our backend:
 * - Rain: the backend fetches encrypted secrets and this client decrypts them.
 * - Wirex: the client calls Wirex directly with a short-lived user token, after
 *   the user signs a confirmation message with their wallet (a passkey prompt).
 *
 * Important: The revealed card details should NOT be stored persistently
 * and must be cleared from memory after use to comply with PCI DSS.
 */
export const useCardDetailsReveal = (
  provider?: CardProvider | null,
): UseCardDetailsRevealReturn => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const isDummyUser = isDummyUserId(selectedUserId);
  // Store card details in local state (not in React Query cache for PCI compliance)
  const [cardDetails, setCardDetails] = useState<CardDetailsRevealResponse | null>(null);
  // Wirex requires a signature from the card's own wallet before it releases the
  // PAN; Rain ignores this.
  const { signMessage } = useWalletMessageSigner();

  const {
    mutateAsync,
    isPending: isMutationLoading,
    error: mutationError,
    reset,
  } = useMutation({
    mutationFn: () => revealCardDetailsComplete(provider ?? undefined, signMessage),
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
    if (isDummyUser) {
      setCardDetails(DUMMY_CARD_REVEAL);
      return;
    }
    await mutateAsync();
  }, [isDummyUser, mutateAsync]);

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
    isLoading: isDummyUser ? false : isMutationLoading,
    error: isDummyUser ? null : error,
    revealDetails,
    clearCardDetails,
  };
};
