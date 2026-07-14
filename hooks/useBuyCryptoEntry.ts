import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getTransfiStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

/**
 * Entry handler for the "Buy crypto" (TransFi) deposit option. Resolves the
 * user's gating status and routes to the right first step:
 *  - ready     → amount/quote screen
 *  - can_share → KYC consent (forward existing Didit KYC to TransFi)
 *  - pending   → KYC pending
 *  - rejected  → KYC pending (renders the rejection state)
 *  - needs_kyc → Didit identity flow (kycFlow = 'transfi'), then returns here
 */
export const useBuyCryptoEntry = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const startKyc = useCallback(() => {
    setKycFlow('transfi');
    setModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.KYC);
  }, [router, setKycFlow, setModal]);

  const handleBuyCryptoPress = useCallback(async () => {
    if (isChecking) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_crypto' });
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
          startKyc();
          break;
      }
    } catch {
      // On any error fall back to the identity flow so the user isn't stuck.
      startKyc();
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, setModal, startKyc]);

  return { handleBuyCryptoPress, isChecking };
};

export default useBuyCryptoEntry;
