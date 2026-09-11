import { useMemo } from 'react';

import useGeoCompliance from '@/hooks/useGeoCompliance';
import { EXPO_PUBLIC_ONRAMPER_COUNTRY, isProduction } from '@/lib/config';
import { isOnramperSupported } from '@/lib/onramper';
import {
  resolveOnramperAvailability,
  resolveOnramperCountryOverride,
} from '@/lib/onramperAvailability';

import type { OnramperAvailability } from '@/lib/onramperAvailability';

/**
 * Whether to offer the Onramper buy-crypto flow, and which country to quote
 * against. The decision lives in `lib/onramperAvailability` — see it for why
 * geography gates nothing here.
 */
export default function useOnramperAvailability(): OnramperAvailability {
  const { countryCode } = useGeoCompliance();

  const countryOverride = resolveOnramperCountryOverride(
    EXPO_PUBLIC_ONRAMPER_COUNTRY,
    isProduction,
  );

  return useMemo(
    () =>
      resolveOnramperAvailability({
        isPlatformSupported: isOnramperSupported,
        countryCode,
        countryOverride,
      }),
    [countryCode, countryOverride],
  );
}
