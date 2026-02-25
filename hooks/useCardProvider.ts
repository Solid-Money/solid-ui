import { useQuery } from '@tanstack/react-query';

import { getCardBalance } from '@/lib/api';
import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { CardProvider } from '@/lib/types';
import { hasCard, withRefreshToken } from '@/lib/utils';

import { cardDetailsQueryOptions } from './useCardDetails';
import { useCardStatus } from './useCardStatus';

const CARD_PROVIDER_PROBE_KEY = 'cardProviderProbe';

/**
 * Resolves card issuer (bridge vs rain). Uses, in order:
 * 1. EXPO_PUBLIC_CARD_ISSUER if set
 * 2. provider from GET /cards/details or GET /cards/status when backend sends it
 * 3. Probe: GET /cards/balance → 200 = rain, 400 = bridge (cached)
 */
export function useCardProvider(): {
  provider: CardProvider | null;
  isLoading: boolean;
} {
  const { data: cardDetails } = useQuery(cardDetailsQueryOptions());
  const { data: cardStatus } = useCardStatus();
  const hasCardData = hasCard(cardStatus) || (!!cardDetails?.id && cardDetails?.provider !== CardProvider.BRIDGE);

  const providerFromResponse =
    cardDetails?.provider ?? cardStatus?.provider ?? undefined;

  const probeQuery = useQuery({
    queryKey: [CARD_PROVIDER_PROBE_KEY],
    queryFn: async (): Promise<CardProvider> => {
      try {
        await withRefreshToken(() => getCardBalance());
        return CardProvider.RAIN;
      } catch (e: unknown) {
        if (e instanceof Response && e.status === 400) return CardProvider.BRIDGE;
        throw e;
      }
    },
    enabled: hasCardData && !providerFromResponse && !EXPO_PUBLIC_CARD_ISSUER,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (EXPO_PUBLIC_CARD_ISSUER) {
    return { provider: EXPO_PUBLIC_CARD_ISSUER, isLoading: false };
  }
  if (providerFromResponse) {
    return { provider: providerFromResponse, isLoading: false };
  }
  if (!hasCardData) {
    return { provider: null, isLoading: false };
  }
  if (probeQuery.isLoading || probeQuery.isFetching) {
    return { provider: null, isLoading: true };
  }
  if (probeQuery.data) {
    return { provider: probeQuery.data, isLoading: false };
  }
  return { provider: null, isLoading: false };
}
