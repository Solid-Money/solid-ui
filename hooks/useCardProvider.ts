import { useQuery } from '@tanstack/react-query';

import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { CardProvider } from '@/lib/types';
import { resolveCardIssuer } from '@/lib/utils/cardStatusRouting';
import { useUserStore } from '@/store/useUserStore';

import { cardDetailsQueryOptions } from './cardDetailsQueryOptions';
import { useCardStatus } from './useCardStatus';

/**
 * Resolves which issuer the user's card is on. Bridge is deprecated and reported
 * as "no card", matching `hasCard`.
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_CARD_ISSUER if set (test/override)
 * 2. The issuer the backend names on `/cards/status` or `/cards/details`
 * 3. Rain, for legacy rows written before the provider field existed
 *
 * Step 2 matters: this used to return `CardProvider.RAIN` for *any* non-Bridge
 * card, because Rain was the only one. Every consumer branches on
 * `provider === RAIN`, so a Wirex card was driven down Rain-only paths — the
 * card-details reveal POSTed to `/cards/secrets` (Rain's encrypted-secrets
 * endpoint) and got back "Card reveal via SessionId is only supported for Rain
 * cards", and the Rain balance/contracts queries fired for a card that has
 * neither.
 */
export function useCardProvider(): {
  provider: CardProvider | null;
  isLoading: boolean;
} {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { data: cardDetails } = useQuery(cardDetailsQueryOptions(selectedUserId));
  const { data: cardStatus } = useCardStatus();

  return {
    provider: resolveCardIssuer({
      cardStatus,
      cardDetails,
      issuerOverride: EXPO_PUBLIC_CARD_ISSUER,
    }),
    isLoading: false,
  };
}
