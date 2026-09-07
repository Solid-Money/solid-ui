export interface OnramperAvailability {
  /** True only when this platform and this country can both complete a buy. */
  isAvailable: boolean;
  isLoading: boolean;
  /** Country to send to Onramper — it refuses to price without one. */
  countryCode: string;
  isPlatformSupported: boolean;
  isCountrySupported: boolean;
}

/**
 * Whether to offer the Onramper buy-crypto flow.
 *
 * Two independent gates.
 *
 * Platform is a hard limit: the package wraps Onramper's *iOS* SDK, so off iOS
 * there is no native checkout button to render at all.
 *
 * Country is not a list. `isCountryServiceable` comes from the backend, which
 * settles it by actually pricing the country's own currency — so a region
 * turning on upstream lights the row up with no client release, and one turning
 * off stops offering a checkout that would fail. A hardcoded allowlist was the
 * obvious alternative and is wrong in both directions: Onramper's
 * `/supported/payment-types` advertises Apple Pay across the EU-27, where
 * nothing prices today, so the list would have to contradict Onramper's own
 * answer and then be maintained by hand against it.
 *
 * Unavailable while either gate is still resolving, rather than defaulting
 * either way: showing the row and then removing it reads as a bug.
 *
 * Kept free of React and of native imports so it can be exercised directly —
 * `useGeoCompliance` reaches MMKV, which does not exist in a test runner.
 */
export const resolveOnramperAvailability = ({
  isPlatformSupported,
  countryCode,
  isCountryServiceable,
  isLoading,
}: {
  isPlatformSupported: boolean;
  countryCode: string;
  /** Backend verdict for `countryCode`; undefined until it resolves. */
  isCountryServiceable: boolean | undefined;
  isLoading: boolean;
}): OnramperAvailability => {
  const normalized = countryCode.toUpperCase();
  const isCountrySupported = isCountryServiceable === true;

  return {
    isAvailable: isPlatformSupported && !isLoading && isCountrySupported,
    isLoading,
    countryCode: normalized,
    isPlatformSupported,
    isCountrySupported,
  };
};
