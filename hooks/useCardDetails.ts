import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { isDummyUserId } from '@/constants/dummyCard';
import { getCardBalance } from '@/lib/api';
import { CardDetailsResponseDto, CardProvider } from '@/lib/types';
import { formatCentsToDollars, withRefreshToken } from '@/lib/utils';
import { selectIsRealtimeLive, useRealtimeStore } from '@/store/useRealtimeStore';
import { useUserStore } from '@/store/useUserStore';

import { cardBalanceQueryKey, cardDetailsQueryOptions } from './cardDetailsQueryOptions';
import { useCardProvider } from './useCardProvider';

/**
 * How often Rain's spending power is re-read. Every 5s is only needed while
 * nothing pushes changes: with the realtime socket up, a card purchase or a
 * deposit refreshes it the moment it lands (see lib/realtime), and the slow
 * poll is just a safety net for changes no event announces.
 */
const CARD_BALANCE_POLL_MS = 5_000;
const CARD_BALANCE_LIVE_POLL_MS = 60_000;

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
  const isRealtimeLive = useRealtimeStore(selectIsRealtimeLive);
  const balanceQuery = useQuery({
    queryKey: cardBalanceQueryKey(selectedUserId),
    queryFn: () => withRefreshToken(() => getCardBalance()),
    enabled: !isDummyUser && provider === CardProvider.RAIN && !!detailsQuery.data,
    retry: false,
    refetchInterval: isRealtimeLive ? CARD_BALANCE_LIVE_POLL_MS : CARD_BALANCE_POLL_MS,
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
      isError: detailsQuery.isError || (provider === CardProvider.RAIN && balanceQuery.isError),
      error: detailsQuery.error ?? (provider === CardProvider.RAIN ? balanceQuery.error : null),
      isLoading:
        detailsQuery.isLoading ||
        (provider === CardProvider.RAIN && !!detailsQuery.data && balanceQuery.isLoading),
    }),
    [
      detailsQuery,
      mergedData,
      provider,
      balanceQuery.isLoading,
      balanceQuery.isError,
      balanceQuery.error,
    ],
  );
};
