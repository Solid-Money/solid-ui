import { useQuery } from '@tanstack/react-query';
import { getCardDetails } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CARD_DETAILS = 'cardDetails';

export const useCardDetails = () => {
  return useQuery({
    queryKey: [CARD_DETAILS],
    queryFn: () => withRefreshToken(() => getCardDetails()),
  });
};
