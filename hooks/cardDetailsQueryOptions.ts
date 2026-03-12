import { getCardDetails } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CARD_DETAILS = 'cardDetails';

export const cardDetailsQueryOptions = () => ({
  queryKey: [CARD_DETAILS],
  queryFn: () => withRefreshToken(() => getCardDetails()),
});
