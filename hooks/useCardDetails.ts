import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getCardBalance, getCardDetails } from '@/lib/api';
import { CardDetailsResponseDto, CardProvider } from '@/lib/types';
import { formatCentsToDollars, withRefreshToken } from '@/lib/utils';

import { useCardProvider } from './useCardProvider';

const CARD_DETAILS = 'cardDetails';
const CARD_BALANCE = 'cardBalance';

// Query options for prefetching card details
export const cardDetailsQueryOptions = () => ({
  queryKey: [CARD_DETAILS],
  queryFn: () => withRefreshToken(() => getCardDetails()),
});

export const useCardDetails = () => {
  const detailsQuery = useQuery(cardDetailsQueryOptions());
  const { provider } = useCardProvider();
  const balanceQuery = useQuery({
    queryKey: [CARD_BALANCE],
    queryFn: () => withRefreshToken(() => getCardBalance()),
    enabled: provider === CardProvider.RAIN && !!detailsQuery.data,
    retry: false,
  });

  const mergedData = useMemo((): CardDetailsResponseDto | undefined => {
    const details = detailsQuery.data;
    if (!details) return undefined;
    if (provider === CardProvider.RAIN && balanceQuery.data != null) {
      const cents = balanceQuery.data.spendingPower ?? 0;
      return {
        ...details,
        balances: {
          available: { amount: formatCentsToDollars(cents), currency: 'USD' },
          hold: details.balances?.hold ?? { amount: '0', currency: 'USD' },
        },
      };
    }
    return details;
  }, [detailsQuery.data, provider, balanceQuery.data]);

  return useMemo(
    () => ({
      ...detailsQuery,
      data: mergedData,
      isLoading: detailsQuery.isLoading || (provider === CardProvider.RAIN && balanceQuery.isLoading),
    }),
    [
      detailsQuery,
      mergedData,
      provider,
      balanceQuery.isLoading,
    ],
  );
};
