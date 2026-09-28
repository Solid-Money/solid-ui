import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { fetchOnramperWidgetSession, OnramperDestination } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const ONRAMPER_WIDGET_SESSION_KEY = 'onramperWidgetSession';

/**
 * A signed widget URL for this platform, delivering to `destination`.
 *
 * Nothing is cached between mounts. Onramper's signature is single-use and
 * expires after 15 minutes, so a URL kept from a previous visit loads a widget
 * that then refuses the checkout — a failure that surfaces only once the user
 * is trying to pay. Minting one per open costs a request and removes the whole
 * class of problem.
 */
export default function useOnramperWidget(destination: OnramperDestination) {
  return useQuery({
    // The destination is part of the key: a wallet URL and a card URL deliver
    // to different addresses, so one must never stand in for the other.
    queryKey: [ONRAMPER_WIDGET_SESSION_KEY, Platform.OS, destination],
    queryFn: () =>
      withRefreshToken(() =>
        fetchOnramperWidgetSession(Platform.OS === 'web' ? 'web' : 'native', destination),
      ),
    // A fresh URL every time this mounts, and none left behind afterwards.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  });
}
