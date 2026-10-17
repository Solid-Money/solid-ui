import { useQuery } from '@tanstack/react-query';

import { getCustomerFromBridge } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CUSTOMER = 'customer';

/**
 * The bridge.xyz customer, for the bank-transfer (fiat rail) flow only. Bridge
 * cards are retired, so nothing on the card side should read this: every mount
 * is a live Bridge API call, and for a card user it only ever failed.
 */
export const useCustomer = () => {
  return useQuery({
    queryKey: [CUSTOMER],
    queryFn: () => withRefreshToken(() => getCustomerFromBridge()),
    retry: false,
  });
};
