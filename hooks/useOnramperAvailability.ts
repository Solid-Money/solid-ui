import { useMemo } from 'react';

import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useOnramperConfig } from '@/hooks/useOnramper';
import { EXPO_PUBLIC_ONRAMPER_COUNTRY, isProduction } from '@/lib/config';
import { isOnramperSupported } from '@/lib/onramper';
import {
  resolveOnramperAvailability,
  resolveOnramperCountryOverride,
} from '@/lib/onramperAvailability';

import type { OnramperAvailability } from '@/lib/onramperAvailability';

/**
 * Whether to offer the Onramper buy-crypto flow to this user, on this platform.
 * The decision itself lives in `lib/onramperAvailability` — see it for why the
 * country gate is a server verdict rather than a list, and what the testing
 * override does and deliberately does not substitute.
 *
 * The config fetch is gated on the platform check, so Android and web never pay
 * for a question whose answer cannot change their outcome.
 */
export default function useOnramperAvailability(): OnramperAvailability {
  const { countryCode, isLoading: isGeoLoading } = useGeoCompliance();

  const countryOverride = resolveOnramperCountryOverride(
    EXPO_PUBLIC_ONRAMPER_COUNTRY,
    isProduction,
  );
  const effectiveCountry = countryOverride ?? countryCode;

  const { data: config, isLoading: isVerdictLoading } = useOnramperConfig(
    effectiveCountry || undefined,
    isOnramperSupported && !!effectiveCountry && (!!countryOverride || !isGeoLoading),
  );

  return useMemo(
    () =>
      resolveOnramperAvailability({
        isPlatformSupported: isOnramperSupported,
        countryCode,
        countryOverride,
        isCountryServiceable: config?.isSupported,
        isGeoLoading,
        isVerdictLoading: isOnramperSupported && isVerdictLoading,
      }),
    [countryCode, countryOverride, isGeoLoading, isVerdictLoading, config?.isSupported],
  );
}
