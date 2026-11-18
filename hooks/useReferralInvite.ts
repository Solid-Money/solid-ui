import { useQuery } from '@tanstack/react-query';
import { minutesToMilliseconds } from 'date-fns';

import { fetchReferralInvite } from '@/lib/api';
import { normalizeReferralCode } from '@/lib/referral/inviteCode';
import { isAnyHTTPError } from '@/lib/utils';

/**
 * Who a referral code belongs to and what the friend gets — the public lookup
 * behind the invite page and the signup "Invite code" field.
 *
 * Disabled for anything that cannot be a code, so a half-typed field never
 * reaches the server. No session involved, so the key is the code alone.
 */
export const useReferralInvite = (code: string | null | undefined) => {
  const normalized = normalizeReferralCode(code);
  return useQuery({
    queryKey: ['referralInvite', normalized],
    queryFn: () => fetchReferralInvite(normalized!),
    enabled: !!normalized,
    staleTime: minutesToMilliseconds(5),
    // Throttled and public: a 4xx (429 included) is not worth asking again.
    retry: (failureCount, error) =>
      !isAnyHTTPError(error, [400, 403, 404, 429]) && failureCount < 1,
    meta: { errorToast: false },
  });
};
