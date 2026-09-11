import { useMemo } from 'react';

import useGeoCompliance from '@/hooks/useGeoCompliance';
import { EXPO_PUBLIC_ONRAMPER_COUNTRY, isDevFeatureEnabled, isProduction } from '@/lib/config';
import { isOnramperSupported } from '@/lib/onramper';
import {
  resolveOnramperAvailability,
  resolveOnramperCountryOverride,
} from '@/lib/onramperAvailability';
import { useOnramperStore } from '@/store/useOnramperStore';

import type { OnramperAvailability } from '@/lib/onramperAvailability';

/**
 * Whether to offer the Onramper buy-crypto flow, and which country to quote
 * against. The decision lives in `lib/onramperAvailability` — see it for why
 * geography gates nothing here, and how the three country sources rank.
 */
export default function useOnramperAvailability(): OnramperAvailability {
  const { countryCode } = useGeoCompliance();
  const selected = useOnramperStore(state => state.country);

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
        // The in-app picker is a testing affordance and must not reach a real
        // user, so a production build ignores whatever is in the store.
        countrySelection: isDevFeatureEnabled ? (selected ?? undefined) : undefined,
      }),
    [countryCode, countryOverride, selected],
  );
}
