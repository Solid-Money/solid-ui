import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { resolveKycProvider } from '@/lib/kycProviderRouting';
import { KycProvider } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

/**
 * Sends an unverified buy-crypto user to the identity provider their country
 * routes to — Wirex countries → Sumsub, everywhere else → Didit — mirroring
 * useCardSteps so a user only ever meets one provider.
 *
 * Falls back to Didit (available everywhere) when the country cannot be resolved
 * at all or the routing call fails. `fallbackProvider` accepts the backend's own
 * suggestion from GET /transfi/status, used when the client has no country.
 *
 * Shared by the entry point and by the mid-flow recovery paths — TransFi can
 * reject a share as needs_kyc if the verification it received was incomplete.
 */
export const useBuyCryptoKycRoute = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const setKycProvider = useKycStore(state => state.setKycProvider);
  const router = useRouter();

  return useCallback(
    async (fallbackProvider?: KycProvider) => {
      setKycFlow('transfi');

      // 'onramp': this identity is for TransFi, which uses Sumsub independently of
      // the Wirex card, so it must not be switched off with the card's kill switch.
      const { kycProvider, countryCode } = await resolveKycProvider(fallbackProvider, 'onramp');

      setKycProvider(kycProvider);
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'route',
        kycFlow: 'transfi',
        kycProvider,
        countryCode,
      });

      setModal(DEPOSIT_MODAL.CLOSE);
      router.push((kycProvider === KycProvider.SUMSUB ? path.SUMSUB_KYC : path.KYC) as any);
    },
    [router, setKycFlow, setKycProvider, setModal],
  );
};

export default useBuyCryptoKycRoute;
