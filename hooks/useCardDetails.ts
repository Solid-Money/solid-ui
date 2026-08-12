import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { isDummyUserId } from '@/constants/dummyCard';
import { getCardBalance } from '@/lib/api';
import { CardDetailsResponseDto, CardProvider } from '@/lib/types';
import { formatCentsToDollars, withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

import { cardDetailsQueryOptions } from './cardDetailsQueryOptions';
import { useCardProvider } from './useCardProvider';

const CARD_BALANCE = 'cardBalance';

// Query options for prefetching card details
// export const cardDetailsQueryOptions = () => ({
//   queryKey: [CARD_DETAILS],
//   queryFn: () => withRefreshToken(() => getCardDetails()),
//   staleTime: 5_000,
//   refetchInterval: 5_000,
// });

export const useCardDetails = () => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const isDummyUser = isDummyUserId(selectedUserId);
  const detailsQuery = useQuery(cardDetailsQueryOptions(selectedUserId));
  const { provider } = useCardProvider();
  const balanceQuery = useQuery({
    queryKey: [CARD_BALANCE, selectedUserId],
    queryFn: () => withRefreshToken(() => getCardBalance()),
    enabled: !isDummyUser && provider === CardProvider.RAIN && !!detailsQuery.data,
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
      isLoading:
        detailsQuery.isLoading ||
        (provider === CardProvider.RAIN && !!detailsQuery.data && balanceQuery.isLoading),
    }),
    [detailsQuery, mergedData, provider, balanceQuery.isLoading],
  );
};
