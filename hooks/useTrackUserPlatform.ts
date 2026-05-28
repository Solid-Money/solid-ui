import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { trackUserPlatform } from '@/lib/api';
import { useUserStore } from '@/store/useUserStore';

const SUPPORTED_PLATFORMS = new Set<typeof Platform.OS>(['ios', 'android', 'web']);

/**
 * Records the current platform (ios/android/web) on the authenticated user's
 * `platforms` array so backend quest checks (e.g. Layer3 "download the native
 * app") can verify which surfaces a user has actually opened the app from.
 * Fires once per app launch per authenticated session.
 */
export function useTrackUserPlatform() {
  const isAuthenticated = useUserStore(state =>
    state.users.some(u => u.selected && !!u.tokens?.accessToken),
  );
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (hasTrackedRef.current) return;
    if (!SUPPORTED_PLATFORMS.has(Platform.OS)) return;

    hasTrackedRef.current = true;
    trackUserPlatform(Platform.OS).catch(err => {
      hasTrackedRef.current = false;
      console.warn('Failed to track user platform:', err);
    });
  }, [isAuthenticated]);
}
