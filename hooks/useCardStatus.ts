import { getCardStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import { useQuery } from '@tanstack/react-query';

export const CARD_STATUS_QUERY_KEY = 'cardStatus';

export const useCardStatus = () => {
  const selectedUser = useUserStore(state => state.users.find(user => user.selected));

  return useQuery({
    queryKey: [CARD_STATUS_QUERY_KEY, selectedUser?.userId],
    queryFn: () => withRefreshToken(() => getCardStatus()),
    retry: false,
    enabled: !!selectedUser,
  });
};
