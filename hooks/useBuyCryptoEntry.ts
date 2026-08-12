import { useCallback, useState } from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { track } from '@/lib/analytics';
import { getTransfiStatus } from '@/lib/api';
import { EXPO_PUBLIC_TRANSFI_SKIP_KYC } from '@/lib/config';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Entry handler for the "Buy crypto" (TransFi) deposit option. Resolves the
 * user's gating status and routes to the right first step:
 *  - ready     → amount/quote screen
 *  - can_share → KYC consent (forward the existing verification to TransFi)
 *  - pending   → KYC pending
 *  - rejected  → KYC pending (renders the rejection state)
 *  - needs_kyc → identity flow (kycFlow = 'transfi'), then returns here
 *
 * Users who already verified with either provider never reach needs_kyc — the
 * backend reports can_share for a Sumsub applicant and for an approved Didit
 * session alike. Only genuinely unverified users are routed to a provider.
 */
export const useBuyCryptoEntry = () => {
  const setModal = useDepositStore(state => state.setModal);
  const routeToKyc = useBuyCryptoKycRoute();
  const [isChecking, setIsChecking] = useState(false);

  const handleBuyCryptoPress = useCallback(async () => {
    if (isChecking) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_crypto' });

    // Sandbox override: skip the status check and the KYC flow entirely.
    if (EXPO_PUBLIC_TRANSFI_SKIP_KYC) {
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
      return;
    }

    setIsChecking(true);
    try {
      const status = await withRefreshToken(() => getTransfiStatus());
      switch (status?.status) {
        case 'ready':
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
          break;
        case 'can_share':
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT);
          break;
        case 'pending':
        case 'rejected':
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
          break;
        case 'needs_kyc':
        default:
          await routeToKyc();
          break;
      }
    } catch (err) {
      // Surface the failure (missing route / auth / network) instead of
      // silently sending the user to KYC, then fall back to the identity flow.
      console.error('TransFi status check failed:', err);
      await routeToKyc();
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, routeToKyc, setModal]);

  return { handleBuyCryptoPress, isChecking };
};

export default useBuyCryptoEntry;
