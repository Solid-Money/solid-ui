import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
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
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_STARTED);

        // First check if we have valid cached country info
        if (countryInfo) {
          track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
            countryCode: countryInfo.countryCode,
            countryName: countryInfo.countryName,
            isAvailable: countryInfo.isAvailable,
            source: 'cached_country_info',
          });

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
          try {
            ip = await getClientIp();
            if (ip) {
              setCachedIp(ip);
              track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FETCHED, { ip });
            } else {
              track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FAILED, { reason: 'no_ip_returned' });
              // If IP detection fails, redirect to country selection
              router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
              return;
            }
          } catch (error) {
            track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FAILED, {
              reason: 'fetch_error',
              error: (error as Error)?.message,
            });
            router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
            return;
          }
        } else {
          track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FETCHED, { ip, source: 'cache' });
        }

        // Check if we have valid cached country info for this IP
        const cachedInfo = getIpDetectedCountry(ip);
        if (cachedInfo) {
          setCountryInfo(cachedInfo);
          track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
            countryCode: cachedInfo.countryCode,
            countryName: cachedInfo.countryName,
            isAvailable: cachedInfo.isAvailable,
            source: 'cached_ip_country',
            ip,
          });

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
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
            reason: 'previous_detection_failed',
            ip,
          });
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        // Fetch country from IP and check access
        const countryData = await getCountryFromIp();
        if (!countryData) {
          setCountryDetectionFailed(true);
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
            reason: 'no_country_data_from_ip',
            ip,
          });
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
          return;
        }

        const { countryCode, countryName } = countryData;
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_DETECTED, {
          countryCode,
          countryName,
          ip,
        });

        // Check card access
        const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));
        if (!accessCheck) {
          setCountryDetectionFailed(true);
          track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
            reason: 'access_check_failed',
            countryCode,
            countryName,
            ip,
          });
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

        track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
          countryCode,
          countryName,
          isAvailable: accessCheck.hasAccess,
          source: 'ip_detection',
          ip,
        });

        if (newCountryInfo.isAvailable) {
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_SUPPORTED, {
            countryCode,
            countryName,
            ip,
          });
          setCheckingCountry(false);
        } else {
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_NOT_SUPPORTED, {
            countryCode,
            countryName,
            ip,
          });
          router.replace(path.CARD_ACTIVATE_COUNTRY_SELECTION);
        }
      } catch (error) {
        console.error('Error checking country:', error);
        setCountryDetectionFailed(true);
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
          reason: 'unexpected_error',
          error: (error as Error)?.message,
        });
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
