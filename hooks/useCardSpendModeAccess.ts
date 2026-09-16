import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getCardSpendModeAccess } from '@/lib/api';

export const CARD_SPEND_MODE_ACCESS_QUERY_KEY = 'cardSpendModeAccess';

/** How long the gate is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this cardholder may see the spend-mode picker and the borrow position.
 *
 * ## Why the server owns this
 *
 * Credit and Smart go to the Wirex internal cohort first, and that cohort is a Mongo
 * collection so the next tester can be added without a release. Neither a build-time flag
 * nor a client-side list could express that — the second would have to ship every member's
 * user id to every device.
 *
 * ## Fails closed, and stays closed while it does not know
 *
 * `false` until the request answers, and `false` if it fails. The two mistakes here are not
 * symmetric: a cohort member waiting a beat for the card to appear is an annoyance they can
 * report, whereas flashing Credit to the whole user base on a failed request is a rollout
 * that cannot be taken back. It also means the surfaces do not appear and then vanish, which
 * is what an optimistic default would produce on every cold start.
 *
 * Cached for five minutes. Cohort membership changes by hand, at human pace, and a per-render
 * refetch of a boolean that almost never moves is a request for nothing.
 */
export const useCardSpendModeAccess = (): { isEnabled: boolean; isLoading: boolean } => {
  const { user } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: [CARD_SPEND_MODE_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getCardSpendModeAccess,
    // Nothing to ask about without a signed-in user, and the request would 401.
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    // A gate that retries forever keeps the surfaces hidden for the same length of time
    // either way; one retry covers a transient blip without holding the query pending.
    retry: 1,
  });

  return {
    isEnabled: data?.enabled === true,
    isLoading: !!user?.userId && isLoading,
  };
};

export default useCardSpendModeAccess;
