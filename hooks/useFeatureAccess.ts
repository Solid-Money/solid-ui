import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getFeatureAccess } from '@/lib/api';
import { WhitelistedFeature } from '@/lib/types';

export const FEATURE_ACCESS_QUERY_KEY = 'featureAccess';

/** How long the answer is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user has a feature that is still held back from the public —
 * Onramper's "Credit card" deposit, or cash-out.
 *
 * ## Why the server owns this
 *
 * One whitelist on the server (`FEATURE_WHITELIST_USERNAMES`) grants all of
 * them, and qa opens them to everyone (`FEATURE_WHITELIST_ENFORCED=false`). A
 * build flag could express neither, and the routes behind these features refuse
 * non-whitelisted users anyway, so the app only mirrors that answer.
 *
 * Cash App is not read from here: it is also open to every US user, which only
 * `/orchestra/config` combines — see useIsCashAppAvailable.
 *
 * ## Fails closed
 *
 * `false` until the request answers, and `false` if it fails, so a feature
 * never flashes on for a user who does not have it. One request serves every
 * feature: the query is shared, and cached for five minutes because the list
 * changes with a deploy, not per render.
 */
export const useHasFeature = (feature: Exclude<WhitelistedFeature, 'cashApp'>): boolean => {
  const { user } = useUser();

  const { data } = useQuery({
    queryKey: [FEATURE_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getFeatureAccess,
    // Nothing to ask about without a signed-in user, and the request would 401.
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    retry: 1,
  });

  return data?.features?.[feature] === true;
};

export default useHasFeature;
