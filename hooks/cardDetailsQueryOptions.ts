import { getCardDetails } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CARD_DETAILS = 'cardDetails';

export const cardDetailsQueryOptions = () => ({
  queryKey: [CARD_DETAILS],
  queryFn: () => withRefreshToken(() => getCardDetails()),
  // Card details (cashback totals, percentage, card metadata) change rarely, so we
  // don't poll them. The live card balance is fetched separately in useCardDetails
  // (the `cardBalance` query, polled every 5s). Polling details every 5s was causing
  // the home cashback card to repeatedly fall back to its loading skeleton.
  staleTime: 60_000,
});
