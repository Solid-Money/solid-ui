import { Platform } from 'react-native';
import { Router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { resolveCountryAccess } from '@/lib/countryAccess';
import { KycStatus } from '@/lib/types';

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
    // On web, render Bridge Persona widget at /bridge-kyc
    router.push({
      pathname: '/bridge-kyc',
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

/**
 * Card country gate for the KYC entry points.
 *
 * Fails open: when the country can't be resolved — every IP provider down, the
 * access check erroring — the user is let through rather than blocked out of
 * KYC on an infrastructure problem. The card issuer rejects an ineligible
 * applicant anyway.
 */
export async function checkCountryAccessForKyc(): Promise<{
  isAvailable: boolean;
  countryName?: string;
  countryCode?: string;
}> {
  const access = await resolveCountryAccess('card', 'kyc_button_click');

  if (!access) {
    track(TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, {
      context: 'kyc_button_click',
    });
    return { isAvailable: true };
  }

  if (!access.isAvailable) {
    track(TRACKING_EVENTS.CARD_KYC_COUNTRY_NOT_SUPPORTED, {
      countryCode: access.countryCode,
      countryName: access.countryName,
      context: 'kyc_button_click',
    });
  }

  return {
    isAvailable: access.isAvailable,
    countryName: access.countryName,
    countryCode: access.countryCode,
  };
}
