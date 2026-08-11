import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { KycProvider } from '@/lib/types';
import { useCountryStore } from '@/store/useCountryStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

/**
 * Sends an unverified buy-crypto user to Sumsub, regardless of jurisdiction.
 *
 * Buy-crypto does not follow the card flow's country routing (Wirex countries →
 * Sumsub, everywhere else → Didit): TransFi is a Sumsub client, so a Sumsub
 * applicant is imported by same-vendor share token, which is the path we want
 * every *new* verification to take. Users who already hold a Didit verification
 * never reach here — the backend reports them as `can_share` and forwards their
 * existing session as documents instead of asking them to verify again.
 *
 * Shared by the entry point and by the mid-flow recovery paths — TransFi can
 * reject a share as needs_kyc if the verification it received was incomplete.
 */
export const useBuyCryptoKycRoute = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const setKycProvider = useKycStore(state => state.setKycProvider);
  const countryCode = useCountryStore(state => state.countryInfo?.countryCode);
  const router = useRouter();

  return useCallback(async () => {
    setKycFlow('transfi');
    setKycProvider(KycProvider.SUMSUB);

    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'route',
      kycFlow: 'transfi',
      kycProvider: KycProvider.SUMSUB,
      countryCode,
    });

    setModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.SUMSUB_KYC as any);
  }, [countryCode, router, setKycFlow, setKycProvider, setModal]);
};

export default useBuyCryptoKycRoute;
