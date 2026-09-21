import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { fetchOnramperWidgetSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const ONRAMPER_WIDGET_SESSION_KEY = 'onramperWidgetSession';

/**
 * A signed widget URL for this platform.
 *
 * Nothing is cached between mounts. Onramper's signature is single-use and
 * expires after 15 minutes, so a URL kept from a previous visit loads a widget
 * that then refuses the checkout — a failure that surfaces only once the user
 * is trying to pay. Minting one per open costs a request and removes the whole
 * class of problem.
 */
export default function useOnramperWidget() {
  return useQuery({
    queryKey: [ONRAMPER_WIDGET_SESSION_KEY, Platform.OS],
    queryFn: () =>
      withRefreshToken(() => fetchOnramperWidgetSession(Platform.OS === 'web' ? 'web' : 'native')),
    // A fresh URL every time this mounts, and none left behind afterwards.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  });
}
