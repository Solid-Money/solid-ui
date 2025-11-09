import * as browserDetection from '@braintree/browser-detection';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getRuntimeRpId } from '@/components/TurnkeyProvider';

// see: https://github.com/stellar/smart-wallet-demo-app/blob/develop/apps/web/src/helpers/browser-environment/index.ts
export function isWebView(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()

  // 1. Check for React Native WebView
  if ((window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !== undefined) {
    return true
  }

  // 2. Check for Android WebView (look for 'wv' in user agent)
  if (userAgent.includes('wv') && userAgent.includes('android')) {
    return true
  }

  // 3. Check for Google App on Android
  if (userAgent.includes('android') && userAgent.includes('googleapp')) {
    return true
  }

  // 4. Check for other Android webviews
  if (
    userAgent.includes('android') &&
    ((userAgent.includes('version/') && userAgent.includes('mobile safari')) ||
      (userAgent.includes('chrome/') && !userAgent.includes('crios/')))
  ) {
    return true
  }

  // 5. Check for iOS WebView (WKWebView)
  if (/iphone|ipad|ipod/.test(userAgent)) {
    // Exclude known browsers that have messageHandlers but aren't webviews
    const isKnownBrowser =
      userAgent.includes('crios/') || // Chrome iOS
      userAgent.includes('fxios/') || // Firefox iOS
      (userAgent.includes('version/') && userAgent.includes('safari/')) // Safari

    // If it's iOS and has webkit message handlers, but NOT a known browser
    if (
      (window as unknown as { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers !== undefined &&
      !isKnownBrowser
    ) {
      return true
    }
    // If it's iOS standalone mode (added to home screen)
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
      return true
    }
    // If it's iOS but missing typical Safari indicators AND not a known browser
    if (!userAgent.includes('version/') && !userAgent.includes('safari/') && !isKnownBrowser) {
      return true
    }
  }

  // 6. Check for specific webview user agents
  if (userAgent.includes('webview') || userAgent.includes('webviewapp')) {
    return true
  }

  // 7. Check for Cordova/PhoneGap
  if (
    (window as unknown as { cordova?: unknown; phonegap?: unknown }).cordova !== undefined ||
    (window as unknown as { cordova?: unknown; phonegap?: unknown }).phonegap !== undefined
  ) {
    return true
  }

  // 8. Check for Ionic
  if ((window as unknown as { Ionic?: unknown }).Ionic !== undefined) {
    return true
  }

  // 9. Check if we're in an iframe
  if (window !== window.top) {
    return true
  }

  return false
}

function isNotSupportedPublicKeyCredentialsError(err: unknown): boolean {
  const e = err as { name?: string; message?: string };
  const name = (e?.name || '').toLowerCase();
  const msg = (e?.message || '').toLowerCase();
  return name === 'notsupportederror' || msg.includes('does not support public key credentials');
}

export async function probeWebAuthnUnsupported(): Promise<boolean> {
  try {
    if (navigator.credentials && typeof navigator.credentials.get === 'function') {
      const abortController = new AbortController();
      const probe = navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(16),
          allowCredentials: [],
          userVerification: 'preferred',
          rpId: getRuntimeRpId(),
        } as PublicKeyCredentialRequestOptions,
        signal: abortController.signal,
      } as CredentialRequestOptions);
      Promise.resolve().then(() => abortController.abort());
      await probe;
    }
    return false;
  } catch (err) {
    if (isNotSupportedPublicKeyCredentialsError(err)) {
      return true;
    }
    return false;
  }
}

export function detectPasskeySupported() {
  if (typeof window === 'undefined') return 'No window';
  if (!window.isSecureContext) return 'Not secure context';
  if (window.self !== window.top) return 'Not top level window';
  if (!('PublicKeyCredential' in window)) return 'No PublicKeyCredential';
  if (typeof window.PublicKeyCredential !== 'function') return 'PublicKeyCredential is not a function';

  const inIosWebview =
    browserDetection.isIosWebview() ||
    browserDetection.isIosUIWebview() ||
    browserDetection.isIosWKWebview();
  if (inIosWebview) return 'In iOS webview';

  return '';
}

export function usePasskey() {
  const [isPasskeySupported, setIsPasskeySupported] = useState<boolean | null>(Platform.OS === 'web' ? null : true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    (async () => {
      const supported = await detectPasskeySupported();
      if (!cancelled) setIsPasskeySupported(Boolean(supported));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isPasskeySupported };
}
