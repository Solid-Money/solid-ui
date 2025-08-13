import { getCardStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

const CARD_STATUS = 'cardStatus';

export const useCardStatus = () => {
  return useQuery({
    queryKey: [CARD_STATUS],
    queryFn: () => withRefreshToken(() => getCardStatus()),
    retry: false,
  });
};
