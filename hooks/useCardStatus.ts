import { getCardStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import { useQuery } from '@tanstack/react-query';

const CARD_STATUS = 'cardStatus';

export const useCardStatus = () => {
  const selectedUser = useUserStore(state => state.users.find(user => user.selected));

  return useQuery({
    queryKey: [CARD_STATUS, selectedUser?.userId],
    queryFn: () => withRefreshToken(() => getCardStatus()),
    retry: false,
    enabled: !!selectedUser,
  });
};
