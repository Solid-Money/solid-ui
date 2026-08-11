import { useQuery } from '@tanstack/react-query';

import { DUMMY_CARD_STATUS, isDummyUserId } from '@/constants/dummyCard';
import { getCardStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const CARD_STATUS_QUERY_KEY = 'cardStatus';

// Query options for prefetching card status
export const cardStatusQueryOptions = (userId: string | undefined) => ({
  queryKey: [CARD_STATUS_QUERY_KEY, userId],
  queryFn: () =>
    isDummyUserId(userId)
      ? Promise.resolve(DUMMY_CARD_STATUS)
      : withRefreshToken(() => getCardStatus()),
  retry: false,
  enabled: !!userId,
});

export const useCardStatus = ({ refetchInterval }: { refetchInterval?: number } = {}) => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);

  return useQuery({
    ...cardStatusQueryOptions(selectedUserId),
    ...(refetchInterval ? { refetchInterval } : {}),
  });
};
