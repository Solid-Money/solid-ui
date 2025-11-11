import { path } from '@/constants/path';
import { KycStatus } from '@/lib/types';
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
