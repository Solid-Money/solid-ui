import Toast from 'react-native-toast-message';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { FingerprintContext, observeFingerprint } from '@/lib/api';
import { VisitorData } from '@/lib/fingerprint';
import { withRefreshToken } from '@/lib/utils';

export interface FingerprintCheckResult {
  canProceed: boolean;
  reason?: 'duplicate_device' | 'error';
}

/**
 * Observe fingerprint and check for duplicate devices BEFORE KYC starts.
 * This allows us to block fraudulent users before incurring KYC costs.
 *
 * Flow:
 * 1. Get visitor data from Fingerprint SDK
 * 2. Call backend to observe + check for duplicates in one request
 * 3. If duplicate and not allowlisted, block and show toast
 *
 * Graceful degradation:
 * - If Fingerprint SDK is unavailable, allow through
 * - If API call fails, allow through (don't block legitimate users on error)
 *
 * @param getVisitorData - Function from useFingerprint hook to get device fingerprint
 * @returns Result indicating whether KYC flow should proceed
 */
export async function observeFingerprintBeforeKyc(
  getVisitorData: () => Promise<VisitorData | null>,
): Promise<FingerprintCheckResult> {
  try {
    const visitorData = await getVisitorData();

    if (!visitorData?.requestId) {
      // Fingerprint SDK not available - allow through (graceful degradation)
      console.warn('[Fingerprint] SDK not available, allowing through');
      return { canProceed: true };
    }

    const result = await withRefreshToken(() =>
      observeFingerprint({
        requestId: visitorData.requestId,
        context: 'kyc_start' as FingerprintContext,
      }),
    );

    track(TRACKING_EVENTS.FINGERPRINT_OBSERVED_BEFORE_KYC, {
      visitorId: result?.visitorId,
      isDuplicate: result?.isDuplicate,
      userCount: result?.userCount,
      isAllowlisted: result?.isAllowlisted,
    });

    // Block if duplicate device and not allowlisted
    if (result?.isDuplicate && !result?.isAllowlisted) {
      Toast.show({
        type: 'error',
        text1: 'Verification required',
        text2: 'Please contact support to continue.',
        props: { badgeText: '' },
      });
      return { canProceed: false, reason: 'duplicate_device' };
    }

    return { canProceed: true };
  } catch (error) {
    // On error, allow through (don't block legitimate users)
    console.error('[Fingerprint] Observation failed:', error);
    return { canProceed: true };
  }
}
