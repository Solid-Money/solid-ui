import { PropsWithChildren } from 'react';
import { FingerprintJsProProvider } from '@fingerprintjs/fingerprintjs-pro-react-native';

import { getFingerprintConfig } from '@/lib/fingerprint';

/**
 * Fingerprint.com Provider for Native iOS/Android.
 *
 * Wraps the app with `FingerprintJsProProvider` from the React Native SDK.
 * If Fingerprint is not configured (no API key), renders children without the provider.
 *
 * @see https://dev.fingerprint.com/docs/fingerprintjs-pro-react-native
 */
export function FingerprintProvider({ children }: PropsWithChildren) {
  const config = getFingerprintConfig();

  // If not configured (e.g., in development without keys), render children without provider
  if (!config) {
    return <>{children}</>;
  }

  return (
    <FingerprintJsProProvider apiKey={config.apiKey} region={config.region}>
      {children}
    </FingerprintJsProProvider>
  );
}
