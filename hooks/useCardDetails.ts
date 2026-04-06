import { useQuery } from '@tanstack/react-query';

import { getCardDetails } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CARD_DETAILS = 'cardDetails';

// Query options for prefetching card details
export const cardDetailsQueryOptions = () => ({
  queryKey: [CARD_DETAILS],
  queryFn: () => withRefreshToken(() => getCardDetails()),
  staleTime: 5_000,
  refetchInterval: 5_000,
});

export const useCardDetails = () => {
  return useQuery(cardDetailsQueryOptions());
};
