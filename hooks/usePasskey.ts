import * as browserDetection from '@braintree/browser-detection';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export async function detectPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (window.self !== window.top) return false;
  if (!('PublicKeyCredential' in window)) return false;

  try {
    if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
      const caps = await PublicKeyCredential.getClientCapabilities();

      const isRelated = caps.relatedOrigins === true;
      const isConditional = caps.conditionalGet === true;
      const isAuthenticator = caps.passkeyPlatformAuthenticator === true;

      const supported = isConditional && isAuthenticator && isRelated;
      if (!supported) return false;
    }
  } catch { }

  try {
    if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
      const cond = await PublicKeyCredential.isConditionalMediationAvailable();
      if (!cond) return false;
    }
  } catch {
    return false;
  }

  try {
    const uvpa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!uvpa) return false;
  } catch {
    return false;
  }

  try {
    const inIosWebview =
      browserDetection.isIosWebview() ||
      browserDetection.isIosUIWebview() ||
      browserDetection.isIosWKWebview();
    if (inIosWebview) return false;
  } catch { }

  return true;
}

export function usePasskey() {
  const [isPasskeySupported, setIsPasskeySupported] = useState<boolean | null>(Platform.OS === 'web' ? null : true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    (async () => {
      const supported = await detectPasskeySupported();
      if (!cancelled) setIsPasskeySupported(supported);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isPasskeySupported };
}
