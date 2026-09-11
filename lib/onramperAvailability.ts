/**
 * Country to run the buy flow as, honouring a testing override.
 *
 * Onramper refuses to price without a country, so one is always sent — this
 * only decides whether it comes from geo or from the override. Returns
 * `undefined` unless a well-formed override is set on a non-production build; a
 * malformed value is ignored rather than sent upstream, where Onramper would
 * reject it and the flow would look broken for the wrong reason.
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
  /** Whether to offer the flow at all. */
  isAvailable: boolean;
  isLoading: boolean;
  /** Country sent to Onramper — it refuses to price without one. */
  countryCode: string;
  isPlatformSupported: boolean;
  /** True when `countryCode` came from the testing override, not from geo. */
  isCountryOverridden: boolean;
}

/**
 * Whether to offer the Onramper buy-crypto flow.
 *
 * Platform only. The package wraps Onramper's *iOS* SDK, so off iOS there is no
 * native checkout button to render at all — a hard limit, not a policy.
 *
 * There is deliberately no region gate here. An earlier version asked the
 * backend whether buys complete in the user's country and hid the row when they
 * did not, which is the right end state but hid the flow from everyone outside
 * the US while the one EU-capable ramp was failing. The screen still reports an
 * unserved region honestly — the asset list comes back empty and no quote is
 * produced — so removing the gate costs discoverability of the failure, not
 * safety. Restore it by gating on the `isSupported` that `/onramper/config`
 * still returns.
 */
export const resolveOnramperAvailability = ({
  isPlatformSupported,
  countryCode,
  countryOverride,
  isGeoLoading,
}: {
  isPlatformSupported: boolean;
  /** Country from geo. Ignored when `countryOverride` is set. */
  countryCode: string;
  /** Testing override from `resolveOnramperCountryOverride`. */
  countryOverride?: string;
  /** The IP lookup is still running. Irrelevant once overridden. */
  isGeoLoading: boolean;
}): OnramperAvailability => {
  const isCountryOverridden = !!countryOverride;
  const normalized = countryOverride ?? countryCode.toUpperCase();

  // An override makes the IP lookup irrelevant, so it must not still be waited
  // on — otherwise a tester in a country the lookup is slow or failing for
  // can't reach the flow they overrode their way into.
  const waiting = isCountryOverridden ? false : isGeoLoading;

  return {
    isAvailable: isPlatformSupported && !waiting,
    isLoading: waiting,
    countryCode: normalized,
    isPlatformSupported,
    isCountryOverridden,
  };
};
