import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import {
  fetchOnramperKycShareAvailability,
  fetchOnramperWidgetSession,
  OnramperDestination,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const ONRAMPER_WIDGET_SESSION_KEY = 'onramperWidgetSession';
const ONRAMPER_KYC_SHARE_KEY = 'onramperKycShare';

/**
 * A signed widget URL for this platform, delivering to `destination`.
 *
 * Nothing is cached between mounts. Onramper's signature is single-use and
 * expires after 15 minutes, so a URL kept from a previous visit loads a widget
 * that then refuses the checkout — a failure that surfaces only once the user
 * is trying to pay. Minting one per open costs a request and removes the whole
 * class of problem.
 *
 * `shareKyc` carries the user's consent to hand their Sumsub verification to
 * Onramper; the share token inside the URL is single-use too.
 */
export default function useOnramperWidget(destination: OnramperDestination, shareKyc = false) {
  return useQuery({
    // The destination is part of the key: a wallet URL and a card URL deliver
    // to different addresses, so one must never stand in for the other. So is
    // consent — a URL carrying identity must not stand in for one without.
    queryKey: [ONRAMPER_WIDGET_SESSION_KEY, Platform.OS, destination, shareKyc],
    queryFn: async () => {
      const session = await withRefreshToken(() =>
        fetchOnramperWidgetSession(Platform.OS === 'web' ? 'web' : 'native', destination, shareKyc),
      );
      // An agreed share can still come back unshared (a stale approval, a
      // Sumsub outage); this is how often that happens.
      if (shareKyc && session) {
        track(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_RESULT, {
          shared: session.kycShared === true,
        });
      }
      return session;
    },
    // A fresh URL every time this mounts, and none left behind afterwards.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  });
}

/**
 * Whether the user could skip the onramp's KYC by sharing their Sumsub
 * verification. Any failure reads as "no": the widget works without it, so the
 * consent step is skipped rather than the purchase blocked.
 */
export function useOnramperKycShare() {
  return useQuery({
    queryKey: [ONRAMPER_KYC_SHARE_KEY],
    queryFn: () => withRefreshToken(() => fetchOnramperKycShareAvailability()),
    retry: 0,
  });
}
