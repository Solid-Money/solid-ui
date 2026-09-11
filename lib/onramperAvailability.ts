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
  /** Whether to offer the flow at all. Platform only. */
  isAvailable: boolean;
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
 * Nothing about geography gates this: not the country, and not whether the IP
 * lookup has finished. An earlier version did both — it asked the backend
 * whether buys complete in the user's country, and waited on geo before
 * deciding — which hid the flow from everyone outside the US while the one
 * EU-capable ramp was failing, and hid it again whenever the lookup was slow.
 * An unserved region still reports itself honestly further in: the asset list
 * comes back empty and no quote is produced.
 *
 * `countryCode` is still resolved, because Onramper refuses to price without
 * one — it just no longer decides whether the row appears. Restore the gate by
 * reading the `isSupported` that `/onramper/config` still returns.
 */
export const resolveOnramperAvailability = ({
  isPlatformSupported,
  countryCode,
  countryOverride,
}: {
  isPlatformSupported: boolean;
  /** Country from geo. Ignored when `countryOverride` is set. */
  countryCode: string;
  /** Testing override from `resolveOnramperCountryOverride`. */
  countryOverride?: string;
}): OnramperAvailability => {
  const isCountryOverridden = !!countryOverride;

  return {
    isAvailable: isPlatformSupported,
    countryCode: countryOverride ?? countryCode.toUpperCase(),
    isPlatformSupported,
    isCountryOverridden,
  };
};
