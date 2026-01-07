import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { formatAttributionForLogging, getCurrentURL, getReferrer } from '@/lib/attribution';
import { useAttributionStore } from '@/store/useAttributionStore';

/**
 * Hook to initialize attribution tracking on app launch
 *
 * Handles both web (URL search params) and mobile (deep links) attribution capture.
 * Should be called once at app root (_layout.tsx) to ensure attribution is captured
 * before any navigation occurs.
 *
 * Web: Captures UTM parameters from window.location.href and referrer
 * Mobile: Captures initial deep link via Linking.getInitialURL() and listens for
 *         subsequent deep links via Linking.addEventListener()
 *
 * @example
 * // In app/_layout.tsx
 * export default function RootLayout() {
 *   useAttributionInitialization();
 *   // ... rest of layout
 * }
 */
export const useAttributionInitialization = () => {
  const attributionStore = useAttributionStore();
  const _hasHydrated = useAttributionStore(state => state._hasHydrated);
  const hasInitialized = useRef(false);
  const subscriptionRef = useRef<ReturnType<typeof Linking.addEventListener> | null>(null);

  useEffect(() => {
    // Wait for store hydration before initialization
    // This ensures we don't overwrite existing first-touch attribution
    if (!_hasHydrated) {
      console.warn('Waiting for attribution store hydration...');
      return;
    }

    // Prevent double initialization (React Strict Mode in dev)
    if (hasInitialized.current) {
      console.warn('Attribution already initialized, skipping');
      return;
    }

    // Set flag immediately to prevent race conditions
    hasInitialized.current = true;

    const initializeAttribution = async () => {
      try {
        console.warn('Initializing attribution tracking...');

        if (Platform.OS === 'web') {
          // WEB: Capture from window.location.href
          // This captures UTM parameters, referral codes, and advertising click IDs
          const currentUrl = getCurrentURL();
          const referrer = getReferrer();

          if (currentUrl) {
            const captured = attributionStore.captureFromURL(currentUrl);

            // Enrich with HTTP referrer if available
            if (captured && referrer) {
              attributionStore.updateAttribution({
                landing_page_referrer: referrer,
              });
            }

            if (captured) {
              console.warn('Attribution captured on web:', formatAttributionForLogging(captured));
            } else {
              console.warn('No attribution parameters found in URL');
            }
          } else {
            console.warn('No current URL available for attribution capture');
          }
        } else {
          // MOBILE: Capture initial deep link URL
          // This handles app launches from Layer3 links, referral links, etc.
          const initialUrl = await Linking.getInitialURL();

          if (initialUrl) {
            console.warn('Initial deep link detected:', initialUrl);
            const captured = attributionStore.captureFromDeepLink(initialUrl);

            if (captured) {
              console.warn(
                'Attribution captured from initial deep link:',
                formatAttributionForLogging(captured),
              );
            } else {
              console.warn('No attribution parameters in deep link');
            }
          } else {
            console.warn('No initial deep link URL - app launched normally');
          }

          // Set up listener for subsequent deep links
          // This handles deep links received while app is already running
          subscriptionRef.current = Linking.addEventListener('url', event => {
            console.warn('Deep link received while app running:', event.url);
            const captured = attributionStore.captureFromDeepLink(event.url);

            if (captured) {
              console.warn(
                'Attribution updated from deep link:',
                formatAttributionForLogging(captured),
              );
            }
          });
        }

        console.warn('Attribution initialization complete');
      } catch (error) {
        console.error('Failed to initialize attribution:', error);
        Sentry.captureException(error, {
          tags: { type: 'attribution_init_error' },
          level: 'error',
          extra: {
            platform: Platform.OS,
          },
        });
      }
    };

    initializeAttribution();

    // Cleanup: Remove mobile deep link listener on unmount
    return () => {
      if (subscriptionRef.current) {
        console.warn('Removing deep link listener on unmount');
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [_hasHydrated, attributionStore]);
};
