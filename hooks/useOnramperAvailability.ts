import { useMemo } from 'react';

import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useOnramperConfig } from '@/hooks/useOnramper';
import { isOnramperSupported } from '@/lib/onramper';
import { resolveOnramperAvailability } from '@/lib/onramperAvailability';

import type { OnramperAvailability } from '@/lib/onramperAvailability';

/**
 * Whether to offer the Onramper buy-crypto flow to this user, on this platform.
 * The decision itself lives in `lib/onramperAvailability` — see it for why the
 * country gate is a server verdict rather than a list.
 *
 * The config fetch is gated on the platform check, so Android and web never pay
 * for a question whose answer cannot change their outcome.
 */
export default function useOnramperAvailability(): OnramperAvailability {
  const { countryCode, isLoading: isCountryLoading } = useGeoCompliance();

  const { data: config, isLoading: isConfigLoading } = useOnramperConfig(
    countryCode || undefined,
    isOnramperSupported && !isCountryLoading && !!countryCode,
  );

  return useMemo(
    () =>
      resolveOnramperAvailability({
        isPlatformSupported: isOnramperSupported,
        countryCode,
        isCountryServiceable: config?.isSupported,
        isLoading: isCountryLoading || (isOnramperSupported && isConfigLoading),
      }),
    [countryCode, isCountryLoading, isConfigLoading, config?.isSupported],
  );
}
