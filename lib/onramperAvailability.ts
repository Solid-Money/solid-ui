/**
 * Countries where a buy actually prices today.
 *
 * Verified by quoting every country that advertises Apple Pay, against USDC and
 * ETH on Ethereum and Base. Only the US returns a quote: coinbasepay is the one
 * working ramp and does Apple Pay nowhere else, while paybis — the only ramp
 * with an EU footprint — fails every request with `OnrampQuoteFetchFailed`.
 *
 * Used purely to label the testing country picker. Nothing filters on it, and
 * no user-facing behaviour depends on it: the real answer always comes from the
 * quote. It exists so an empty asset list reads as "this country isn't served"
 * rather than "something is broken".
 */
export const ONRAMPER_QUOTING_COUNTRIES = ['US'];

/**
 * Countries Onramper advertises Apple Pay in — the EU-27 plus the US.
 *
 * Every one of the EU entries advertises support and then returns no quote, so
 * this is the "looks available, isn't" set. Kept distinct from the list above so
 * the picker can say which is which.
 */
export const ONRAMPER_APPLE_PAY_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'US',
];

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
  countrySelection,
}: {
  isPlatformSupported: boolean;
  /** Country from geo. Used only when nothing overrides it. */
  countryCode: string;
  /** Build-time testing override from `resolveOnramperCountryOverride`. */
  countryOverride?: string;
  /**
   * Country picked by hand in the app on a qa/preview build. Wins over the
   * env override, which in turn wins over geo — a tester who just chose a
   * country in the UI means it more recently than whoever set the .env.
   */
  countrySelection?: string;
}): OnramperAvailability => {
  const chosen = countrySelection ?? countryOverride;

  return {
    isAvailable: isPlatformSupported,
    countryCode: (chosen ?? countryCode).toUpperCase(),
    isPlatformSupported,
    isCountryOverridden: !!chosen,
  };
};
