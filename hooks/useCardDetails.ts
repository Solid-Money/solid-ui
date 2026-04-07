import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getCardBalance } from '@/lib/api';
import { CardDetailsResponseDto, CardProvider } from '@/lib/types';
import { formatCentsToDollars, withRefreshToken } from '@/lib/utils';

import { cardDetailsQueryOptions } from './cardDetailsQueryOptions';
import { useCardProvider } from './useCardProvider';

const CARD_BALANCE = 'cardBalance';

export const useCardDetails = () => {
  const detailsQuery = useQuery(cardDetailsQueryOptions());
  const { provider } = useCardProvider();
  const balanceQuery = useQuery({
    queryKey: [CARD_BALANCE],
    queryFn: () => withRefreshToken(() => getCardBalance()),
    enabled: provider === CardProvider.RAIN && !!detailsQuery.data,
    retry: false,
    refetchInterval: 5000,
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
      isLoading: detailsQuery.isLoading,
    }),
    [detailsQuery, mergedData],
  );
};
