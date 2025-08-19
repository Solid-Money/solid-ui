import { path } from '@/constants/path';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Router } from 'expo-router';

type StartKycFlowParams = {
  router: Router;
  kycLink: string;
  redirectUri: string;
};

export function startKycFlow(params: StartKycFlowParams) {
  const { router, kycLink, redirectUri } = params;

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
      params: { url: kycLink, redirectUri },
    });
  }
}
