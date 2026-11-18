import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';

import { fetchCardCreditHistory, fetchCardCreditSummary } from '@/lib/api';
import { isAnyHTTPError, withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const CARD_CREDIT_QUERY_KEY = 'cardCredit';

const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

/** A 4xx will not change on a retry: the endpoint is not there yet, or not for this user. */
const retryUnlessClientError = (failureCount: number, error: unknown) =>
  !isAnyHTTPError(error, [400, 401, 403, 404, 405, 410, 422]) && failureCount < 1;

/**
 * The user's card credit.
 *
 * Every surface that shows it — the Home pill, the card credit sheet — hides
 * itself when this fails, so it never toasts: card credit missing from the
 * screen is the right way for it to degrade, not an error to report. Keyed by
 * user like the rewards queries, so switching accounts never shows the last
 * account's credit.
 */
export const useCardCredit = (options?: { enabled?: boolean }) => {
  const userId = useSelectedUserId();
  return useQuery({
    queryKey: [CARD_CREDIT_QUERY_KEY, 'summary', userId],
    queryFn: () => withRefreshToken(() => fetchCardCreditSummary()),
    enabled: !!userId && options?.enabled !== false,
    staleTime: secondsToMilliseconds(60),
    gcTime: secondsToMilliseconds(300),
    retry: retryUnlessClientError,
    meta: { errorToast: false },
  });
};

/** Card credit grants, holds, spends and refunds, newest first. */
export const useCardCreditHistory = (options?: { enabled?: boolean; limit?: number }) => {
  const userId = useSelectedUserId();
  const limit = options?.limit ?? 50;
  return useQuery({
    queryKey: [CARD_CREDIT_QUERY_KEY, 'history', userId, limit],
    queryFn: () => withRefreshToken(() => fetchCardCreditHistory({ limit })),
    enabled: !!userId && options?.enabled !== false,
    staleTime: secondsToMilliseconds(60),
    gcTime: secondsToMilliseconds(300),
    retry: retryUnlessClientError,
    meta: { errorToast: false },
  });
};
