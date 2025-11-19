import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { Router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

type StartKycFlowParams = {
  router: Router;
  kycLink: string;
};

export function startKycFlow(params: StartKycFlowParams) {
  const { router, kycLink } = params;

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    WebBrowser.openBrowserAsync(kycLink, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: '#94F27F',
      toolbarColor: '#94F27F',
      showTitle: true,
      enableBarCollapsing: true,
    });
  } else {
    // On web, we render the KYC widget in /kyc, forwarding the link and redirectUri

    router.push({
      pathname: path.KYC,
      params: { url: kycLink },
    });
  }
}

// Utility: determine if a KYC status is final (approved/rejected/offboarded)
export function isFinalKycStatus(status?: string | KycStatus): boolean {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return (
    normalized === KycStatus.APPROVED ||
    normalized === KycStatus.REJECTED ||
    normalized === KycStatus.OFFBOARDED
  );
}

// Utility: check country access before allowing KYC
export async function checkCountryAccessForKyc(countryStore: {
  getCachedIp: () => string | null;
  setCachedIp: (ip: string) => void;
  getIpDetectedCountry: (ip: string) => any;
  setIpDetectedCountry: (ip: string, countryInfo: any) => void;
  countryDetectionFailed: boolean;
}): Promise<{ isAvailable: boolean; countryName?: string; countryCode?: string }> {
  try {
    const { getCachedIp, setCachedIp, getIpDetectedCountry, setIpDetectedCountry } = countryStore;

    // First check if we have valid cached country info
    const cachedIp = getCachedIp();

    if (cachedIp) {
      const cachedCountryInfo = getIpDetectedCountry(cachedIp);

      if (cachedCountryInfo) {
        return {
          isAvailable: cachedCountryInfo.isAvailable,
          countryName: cachedCountryInfo.countryName,
          countryCode: cachedCountryInfo.countryCode,
        };
      }
    }

    // Try to get cached IP
    let ip = getCachedIp();

    // If no cached IP, fetch a new one
    if (!ip) {
      ip = await getClientIp();
      if (ip) {
        setCachedIp(ip);
      } else {
        // If IP detection fails, allow access
        track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
          reason: 'ip_detection_failed',
          context: 'kyc_button_click',
        });
        return { isAvailable: true };
      }
    }

    // Check if we have valid cached country info for this IP
    const cachedInfo = getIpDetectedCountry(ip);

    if (cachedInfo) {
      return {
        isAvailable: cachedInfo.isAvailable,
        countryName: cachedInfo.countryName,
        countryCode: cachedInfo.countryCode,
      };
    }

    // Fetch country from IP and check access
    const countryData = await getCountryFromIp();

    if (!countryData) {
      // If country detection fails, allow access
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
        reason: 'country_detection_failed',
        context: 'kyc_button_click',
      });

      return { isAvailable: true };
    }

    const { countryCode, countryName } = countryData;

    // Check card access
    const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));

    if (!accessCheck) {
      // If card access check fails, allow access
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
        reason: 'card_access_check_failed',
        context: 'kyc_button_click',
      });

      throw new Error('Card access check failed');
    }

    const countryInfo = {
      countryCode,
      countryName,
      isAvailable: accessCheck.hasAccess,
    };

    // Cache the country info
    setIpDetectedCountry(ip, countryInfo);

    if (!accessCheck.hasAccess) {
      // Track when country is detected and confirmed not supported
      track(TRACKING_EVENTS.CARD_KYC_COUNTRY_NOT_SUPPORTED, {
        countryCode,
        countryName,
        context: 'kyc_button_click',
      });
    }

    return {
      isAvailable: accessCheck.hasAccess,
      countryName,
      countryCode,
    };
  } catch (error) {
    console.error('Error checking country access for KYC:', error);
    // If any error occurs during country checking, allow access
    track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
      reason: 'unexpected_error',
      context: 'kyc_button_click',
      error: (error as Error)?.message,
    });
    return { isAvailable: true };
  }
}
