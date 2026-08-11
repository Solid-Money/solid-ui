import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getProviderRouting } from '@/lib/api';
import { KycProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

/**
 * Sends an unverified buy-crypto user to the identity provider their country
 * routes to — Wirex countries → Sumsub, everywhere else → Didit — mirroring
 * useCardSteps so a user only ever meets one provider.
 *
 * Falls back to Didit (available everywhere) when the country is unknown or the
 * routing call fails. `fallbackProvider` accepts the backend's own suggestion
 * from GET /transfi/status, used when the client has no country of its own.
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

  return useCallback(
    async (fallbackProvider?: KycProvider) => {
      setKycFlow('transfi');

      let kycProvider = fallbackProvider ?? KycProvider.DIDIT;
      if (countryCode) {
        try {
          const routing = await withRefreshToken(() => getProviderRouting(countryCode));
          if (routing?.kycProvider) kycProvider = routing.kycProvider;
        } catch {
          // backend unavailable → keep the fallback
        }
      }

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
    [countryCode, router, setKycFlow, setKycProvider, setModal],
  );
};

export default useBuyCryptoKycRoute;
