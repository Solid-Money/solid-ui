import { useCallback } from 'react';
import { useVisitorData } from '@fingerprintjs/fingerprintjs-pro-react-native';
import * as Sentry from '@sentry/react-native';

import { getFingerprintConfig, VisitorData } from '@/lib/fingerprint';

/**
 * Hook for Fingerprint.com device intelligence (Native iOS/Android).
 *
 * Requires the app to be wrapped in `FingerprintProvider`.
 *
 * @example
 * ```tsx
 * const { getVisitorData, isLoading } = useFingerprint();
 *
 * const handleVerify = async () => {
 *   const data = await getVisitorData();
 *   if (data) {
 *     await verifyCountryWithFingerprint({
 *       visitorId: data.visitorId,
 *       requestId: data.requestId,
 *       claimedCountry: selectedCountry.code,
 *     });
 *   }
 * };
 * ```
 */
export function useFingerprint() {
  const config = getFingerprintConfig();
  const { isLoading, error, getData } = useVisitorData();

  const getVisitorData = useCallback(async (): Promise<VisitorData | null> => {
    if (!config) {
      console.warn('[Fingerprint Native] API key not configured');
      return null;
    }

    try {
      const result = await getData({ ignoreCache: true });

      if (!result?.visitorId || !result?.requestId) {
        console.warn('[Fingerprint Native] Invalid visitor data received');
        return null;
      }

      console.log('[Fingerprint Native] Visitor data fetched successfully');

      return {
        visitorId: result.visitorId,
        requestId: result.requestId,
        confidence: result.confidence || { score: 0 },
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'fingerprint', action: 'getVisitorData', platform: 'native' },
      });
      console.error('[Fingerprint Native] Failed to get visitor data:', err);
      return null;
    }
  }, [config, getData]);

  return {
    isLoading,
    error: error || null,
    getVisitorData,
    isAvailable: !!config,
  };
}
