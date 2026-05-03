import { useQuery } from '@tanstack/react-query';

import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { CardProvider } from '@/lib/types';
import { hasCard } from '@/lib/utils';

import { cardDetailsQueryOptions } from './cardDetailsQueryOptions';
import { useCardStatus } from './useCardStatus';

/**
 * Resolves card issuer. Bridge is deprecated — Rain is the only supported provider.
 * Uses, in order:
 * 1. EXPO_PUBLIC_CARD_ISSUER if set (test/override)
 * 2. Rain when the user has an active Rain card (Bridge-only users are treated as no card)
 */
export function useCardProvider(): {
  provider: CardProvider | null;
  isLoading: boolean;
} {
  const { data: cardDetails } = useQuery(cardDetailsQueryOptions());
  const { data: cardStatus } = useCardStatus();

  if (EXPO_PUBLIC_CARD_ISSUER) {
    return { provider: EXPO_PUBLIC_CARD_ISSUER, isLoading: false };
  }

  const hasRainCard =
    hasCard(cardStatus) ||
    (!!cardDetails?.id && cardDetails?.provider !== CardProvider.BRIDGE);

  return { provider: hasRainCard ? CardProvider.RAIN : null, isLoading: false };
}
