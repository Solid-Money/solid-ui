import { Endorsements } from '@/components/BankTransfer/enums';
import { KycMode } from '@/components/UserKyc';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getKycLinkForExistingCustomer } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { checkCountryAccessForKyc, startKycFlow } from '@/lib/utils/kyc';
import { Router } from 'expo-router';
import Toast from 'react-native-toast-message';

/**
 * Build the redirect URI for KYC completion
 */
export function buildKycRedirectUri(): string {
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  return `${baseUrl}${path.CARD_ACTIVATE}?kycStatus=${KycStatus.UNDER_REVIEW}`;
}

/**
 * Check country access and block if not available
 * @returns true if blocked (country not supported)
 */
export async function checkAndBlockForCountryAccess(
  countryStore: {
    getCachedIp: () => string | null;
    setCachedIp: (ip: string) => void;
    getIpDetectedCountry: (ip: string) => any;
    setIpDetectedCountry: (ip: string, country: any) => void;
    countryDetectionFailed: boolean;
  },
  kycLinkId: string | null,
): Promise<boolean> {
  const countryCheck = await checkCountryAccessForKyc({
    getCachedIp: countryStore.getCachedIp,
    setCachedIp: countryStore.setCachedIp,
    getIpDetectedCountry: countryStore.getIpDetectedCountry,
    setIpDetectedCountry: countryStore.setIpDetectedCountry,
    countryDetectionFailed: countryStore.countryDetectionFailed,
  });

  if (!countryCheck.isAvailable) {
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'blocked',
      reason: 'country_not_supported',
      kycLinkId,
      countryCode: countryCheck.countryCode,
      countryName: countryCheck.countryName,
    });

    Toast.show({
      type: 'error',
      text1: 'Country not supported',
      text2: countryCheck.countryName
        ? `Unfortunately, Solid card isn't available in ${countryCheck.countryName} yet.`
        : 'Unfortunately, Solid card is not available in your location yet.',
      props: { badgeText: '' },
    });
    return true;
  }

  return false;
}

/**
 * Show KYC under review toast and track
 */
export function showKycUnderReviewToast(kycLinkId: string | null): void {
  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'blocked',
    reason: 'under_review',
    kycLinkId,
  });
  Toast.show({
    type: 'info',
    text1: 'KYC under review',
    text2: 'Please wait while we complete the review.',
    props: { badgeText: '' },
  });
}

/**
 * Show account offboarded toast and track
 */
export function showAccountOffboardedToast(kycLinkId: string | null): void {
  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'blocked',
    reason: 'offboarded',
    kycLinkId,
  });
  Toast.show({
    type: 'error',
    text1: 'Account offboarded',
    text2: 'Please contact support for assistance.',
    props: { badgeText: '' },
  });
}

/**
 * Redirect to existing customer KYC link for cards endorsement
 * @returns true if redirect succeeded
 */
export async function redirectToExistingCustomerKycLink(
  router: Router,
  kycLinkId: string | null,
): Promise<boolean> {
  const redirectUri = buildKycRedirectUri();

  try {
    const existingCustomerKycLink = await withRefreshToken(() =>
      getKycLinkForExistingCustomer({
        endorsement: Endorsements.CARDS,
        redirectUri,
      }),
    );

    if (!existingCustomerKycLink) {
      throw new Error('Failed to get KYC link for existing customer');
    }

    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'redirect',
      method: 'existing_customer_endorsement',
      kycLinkId,
    });

    startKycFlow({ router, kycLink: existingCustomerKycLink.url });
    return true;
  } catch (error) {
    console.error('Failed to get KYC link for existing customer:', error);
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'existing_customer_link_failed',
      kycLinkId,
    });
    return false;
  }
}

/**
 * Redirect using an existing KYC link
 * @returns true if redirect succeeded
 */
export function redirectToExistingKycLink(
  router: Router,
  kycLink: string,
  kycLinkId: string | null,
): boolean {
  const redirectUri = buildKycRedirectUri();

  try {
    const urlObj = new URL(kycLink);
    if (!urlObj.searchParams.has('redirect-uri') && !urlObj.searchParams.has('redirect_uri')) {
      urlObj.searchParams.set('redirect-uri', redirectUri);
    }
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'redirect',
      method: 'existing_link',
      kycLinkId,
    });
    startKycFlow({ router, kycLink: urlObj.toString() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Redirect to collect user info for new KYC
 */
export function redirectToCollectUserInfo(router: Router): void {
  const redirectUri = buildKycRedirectUri();
  const params = new URLSearchParams({
    kycMode: KycMode.CARD,
    endorsement: Endorsements.CARDS,
    redirectUri,
  }).toString();

  track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
    action: 'redirect',
    method: 'collect_user_info',
  });
  router.push(`/user-kyc-info?${params}`);
}
