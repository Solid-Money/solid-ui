import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export function useCountryCheck(options?: { skip?: boolean }) {
  const router = useRouter();
  const [checkingCountry, setCheckingCountry] = useState(!options?.skip);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasChecked = useRef(false);

  const {
    countryInfo,
    setCountryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    countryDetectionFailed,
    setCountryDetectionFailed,
  } = useCountryStore(
    useShallow(state => ({
      countryInfo: state.countryInfo,
      setCountryInfo: state.setCountryInfo,
      getIpDetectedCountry: state.getIpDetectedCountry,
      setIpDetectedCountry: state.setIpDetectedCountry,
      getCachedIp: state.getCachedIp,
      setCachedIp: state.setCachedIp,
      countryDetectionFailed: state.countryDetectionFailed,
      setCountryDetectionFailed: state.setCountryDetectionFailed,
    })),
  );

  // Allow both IP-detected and manually-selected supported countries
  const validCountryInfo = countryInfo?.isAvailable ? countryInfo : null;

  useEffect(() => {
    const checkCountry = async () => {
      // If skip is true, don't run country check (e.g., user already has a card)
      if (options?.skip) {
        hasChecked.current = true;
        setCheckingCountry(false);
        return;
      }

      // If we are already redirecting, do nothing
      if (isRedirecting) return;

      // If we already checked and have a result, stop checking
      if (hasChecked.current && !checkingCountry) return;

      try {
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_STARTED);

        // ALWAYS redirect to country selection - card activation is disabled
        // This ensures users always see the "country not available" message
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
          reason: 'card_activation_disabled',
        });
        setIsRedirecting(true);
        router.replace(path.CARD_COUNTRY_SELECTION);
        return;
      } catch (error) {
        console.error('Error checking country:', error);
      }
    };

    checkCountry();
  }, [router, checkingCountry, isRedirecting, options?.skip]);

  return { checkingCountry };
}
