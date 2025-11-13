import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { path } from '@/constants/path';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export function useCountryCheck() {
  const router = useRouter();
  const [checkingCountry, setCheckingCountry] = useState(true);

  const {
    countryInfo,
    setCountryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    countryDetectionFailed,
    setCountryDetectionFailed,
  } = useCountryStore();

  useEffect(() => {
    const checkCountry = async () => {
      try {
        // First check if we have valid cached country info
        if (countryInfo) {
          // If country is available, proceed with activation
          if (countryInfo.isAvailable) {
            setCheckingCountry(false);
            return;
          }
          // If country is not available, redirect to country selection
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        // Try to get cached IP
        let ip = getCachedIp();

        // If no cached IP, fetch a new one
        if (!ip) {
          ip = await getClientIp();
          if (ip) {
            setCachedIp(ip);
          } else {
            // If IP detection fails, redirect to country selection
            router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
            return;
          }
        }

        // Check if we have valid cached country info for this IP
        const cachedInfo = getIpDetectedCountry(ip);
        if (cachedInfo) {
          setCountryInfo(cachedInfo);

          if (cachedInfo.isAvailable) {
            setCheckingCountry(false);
            return;
          } else {
            router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
            return;
          }
        }

        // If country detection already failed, redirect to selection
        if (countryDetectionFailed) {
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        // Fetch country from IP and check access
        const countryData = await getCountryFromIp();
        if (!countryData) {
          setCountryDetectionFailed(true);
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        const { countryCode, countryName } = countryData;

        // Check card access
        const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));
        if (!accessCheck) {
          setCountryDetectionFailed(true);
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        const newCountryInfo = {
          countryCode,
          countryName,
          isAvailable: accessCheck.hasAccess,
        };

        // Cache the country info
        setIpDetectedCountry(ip, newCountryInfo);
        setCountryDetectionFailed(false);

        if (newCountryInfo.isAvailable) {
          setCheckingCountry(false);
        } else {
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
        }
      } catch (error) {
        console.error('Error checking country:', error);
        setCountryDetectionFailed(true);
        router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
      }
    };

    checkCountry();
  }, [
    router,
    countryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    setCountryInfo,
    countryDetectionFailed,
    setCountryDetectionFailed,
  ]);

  return { checkingCountry };
}
