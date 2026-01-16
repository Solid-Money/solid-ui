import { useQuery } from '@tanstack/react-query';

import { getCardStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const CARD_STATUS_QUERY_KEY = 'cardStatus';

// Query options for prefetching card status
export const cardStatusQueryOptions = (userId: string | undefined) => ({
  queryKey: [CARD_STATUS_QUERY_KEY, userId],
  queryFn: () => withRefreshToken(() => getCardStatus()),
  retry: false,
  enabled: !!userId,
});

export const useCardStatus = () => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);

  return useQuery(cardStatusQueryOptions(selectedUserId));
};
