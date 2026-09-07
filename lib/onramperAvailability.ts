/**
 * The country to run the buy flow as, honouring a testing override.
 *
 * Substituting the country rather than the verdict is deliberate: the backend
 * still decides whether buys complete there, so config, assets, quotes and
 * limits are all fetched for real and the whole chain is exercised. Overriding
 * `isSupported` instead would surface the entry row and then a dead screen,
 * because the asset list for the real country is legitimately empty.
 *
 * Returns `undefined` unless a well-formed override is set on a non-production
 * build — a malformed value is ignored rather than sent upstream, where
 * Onramper would reject it and the flow would look broken for the wrong reason.
 */
export const resolveOnramperCountryOverride = (
  raw: string | undefined,
  isProductionBuild: boolean,
): string | undefined => {
  if (isProductionBuild) return undefined;

  const code = (raw ?? '').trim().toUpperCase();

  return /^[A-Z]{2}$/.test(code) ? code : undefined;
};

export interface OnramperAvailability {
  /** True only when this platform and this country can both complete a buy. */
  isAvailable: boolean;
  isLoading: boolean;
  /** Country to send to Onramper — it refuses to price without one. */
  countryCode: string;
  isPlatformSupported: boolean;
  isCountrySupported: boolean;
  /** True when `countryCode` came from the testing override, not from geo. */
  isCountryOverridden: boolean;
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
  countryOverride,
  isCountryServiceable,
  isGeoLoading,
  isVerdictLoading,
}: {
  isPlatformSupported: boolean;
  /** Country from geo. Ignored when `countryOverride` is set. */
  countryCode: string;
  /** Testing override from `resolveOnramperCountryOverride`. */
  countryOverride?: string;
  /** Backend verdict for the effective country; undefined until it resolves. */
  isCountryServiceable: boolean | undefined;
  /** The IP lookup is still running. Irrelevant once overridden. */
  isGeoLoading: boolean;
  /** The backend verdict is still in flight. Never skippable — the answer is
   *  what decides availability, override or not. */
  isVerdictLoading: boolean;
}): OnramperAvailability => {
  const isCountryOverridden = !!countryOverride;
  const normalized = countryOverride ?? countryCode.toUpperCase();
  const isCountrySupported = isCountryServiceable === true;

  // An override makes the IP lookup irrelevant, so it must not still be waited
  // on — otherwise a tester in a country the lookup is slow or failing for
  // can't reach the flow they overrode their way into. The verdict is a
  // different matter and is always awaited.
  const waiting = (isCountryOverridden ? false : isGeoLoading) || isVerdictLoading;

  return {
    isAvailable: isPlatformSupported && !waiting && isCountrySupported,
    isLoading: waiting,
    countryCode: normalized,
    isPlatformSupported,
    isCountrySupported,
    isCountryOverridden,
  };
};
