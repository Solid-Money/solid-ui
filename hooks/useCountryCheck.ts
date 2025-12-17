import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export function useCountryCheck() {
  const router = useRouter();
  const [checkingCountry, setCheckingCountry] = useState(true);
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
  } = useCountryStore();

  // Allow both IP-detected and manually-selected supported countries
  const validCountryInfo = countryInfo?.isAvailable ? countryInfo : null;

  useEffect(() => {
    const checkCountry = async () => {
      // If we are already redirecting, do nothing
      if (isRedirecting) return;

      // If we already checked and have a result, stop checking
      if (hasChecked.current && !checkingCountry) return;

      try {
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_STARTED);

        // First check if we have valid cached country info (IP or manual)
        if (validCountryInfo) {
          track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
            countryCode: validCountryInfo.countryCode,
            countryName: validCountryInfo.countryName,
            isAvailable: validCountryInfo.isAvailable,
            source: 'cached_country_info',
          });

          // If country is available, proceed with activation
          hasChecked.current = true;
          setCheckingCountry(false);
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
              setIsRedirecting(true);
              router.replace(path.CARD_COUNTRY_SELECTION);
              return;
            }
          } catch (error) {
            track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FAILED, {
              reason: 'fetch_error',
              error: (error as Error)?.message,
            });
            setIsRedirecting(true);
            router.replace(path.CARD_COUNTRY_SELECTION);
            return;
          }
        } else {
          track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_IP_FETCHED, { ip, source: 'cache' });
        }

        // Check if we have valid cached country info for this IP
        const cachedInfo = getIpDetectedCountry(ip);
        if (cachedInfo) {
          track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
            countryCode: cachedInfo.countryCode,
            countryName: cachedInfo.countryName,
            isAvailable: cachedInfo.isAvailable,
            source: 'cached_ip_country',
            ip,
          });
          // Only update store if the info has changed to avoid infinite loops
          if (
            countryInfo?.countryCode !== cachedInfo.countryCode ||
            countryInfo?.isAvailable !== cachedInfo.isAvailable
          ) {
            setCountryInfo(cachedInfo);
          }
          track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
            countryCode: cachedInfo.countryCode,
            countryName: cachedInfo.countryName,
            isAvailable: cachedInfo.isAvailable,
            source: 'cached_ip_country',
            ip,
          });

          if (cachedInfo.isAvailable) {
            hasChecked.current = true;
            setCheckingCountry(false);
            return;
          } else {
            setIsRedirecting(true);
            router.replace(path.CARD_COUNTRY_SELECTION);
            return;
          }
        }

        // If country detection already failed, redirect to selection
        if (countryDetectionFailed) {
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
            reason: 'previous_detection_failed',
            ip,
          });
          setIsRedirecting(true);
          router.replace(path.CARD_COUNTRY_SELECTION);
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
          setIsRedirecting(true);
          router.replace(path.CARD_COUNTRY_SELECTION);
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
          setIsRedirecting(true);
          router.replace(path.CARD_COUNTRY_SELECTION);
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
          hasChecked.current = true;
          setCheckingCountry(false);
        } else {
          track(TRACKING_EVENTS.CARD_KYC_COUNTRY_NOT_SUPPORTED, {
            countryCode,
            countryName,
            ip,
          });
          setIsRedirecting(true);
          router.replace(path.CARD_COUNTRY_SELECTION);
        }
      } catch (error) {
        console.error('Error checking country:', error);
        setCountryDetectionFailed(true);
        track(TRACKING_EVENTS.CARD_COUNTRY_CHECK_FAILED, {
          reason: 'unexpected_error',
          error: (error as Error)?.message,
        });
        setIsRedirecting(true);
        router.replace(path.CARD_COUNTRY_SELECTION);
      }
    };

    checkCountry();
  }, [
    router,
    validCountryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    setCountryInfo,
    countryDetectionFailed,
    setCountryDetectionFailed,
    checkingCountry,
    isRedirecting,
  ]);

  return { checkingCountry };
}
