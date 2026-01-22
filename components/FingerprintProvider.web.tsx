import { PropsWithChildren } from 'react';
import { FpjsProvider } from '@fingerprintjs/fingerprintjs-pro-react';

import { getFingerprintConfig } from '@/lib/fingerprint';

/**
 * Fingerprint.com Provider for Web.
 *
 * Wraps the app with `FpjsProvider` from the React (web) SDK.
 * If Fingerprint is not configured (no API key), renders children without the provider.
 *
 * @see https://github.com/fingerprintjs/fingerprintjs-pro-react
 */
export function FingerprintProvider({ children }: PropsWithChildren) {
  const config = getFingerprintConfig();

  // If not configured (e.g., in development without keys), render children without provider
  if (!config) {
    return <>{children}</>;
  }

  return (
    <FpjsProvider
      loadOptions={{
        apiKey: config.apiKey,
        region: config.region,
      }}
    >
      {children}
    </FpjsProvider>
  );
}
