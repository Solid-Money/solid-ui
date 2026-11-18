import { EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES } from '@/lib/config';

export const OFAC_SANCTIONED_COUNTRIES = ['CU', 'IR', 'KP', 'SY', 'RU', 'BY'] as const;

export const CRYPTO_BANNED_COUNTRIES = [
  'CN',
  'DZ',
  'BD',
  'BO',
  'EG',
  'IQ',
  'NP',
  'QA',
  'TN',
  'MA',
  'AF',
] as const;

export const ALL_RESTRICTED_COUNTRIES: string[] = [
  ...OFAC_SANCTIONED_COUNTRIES,
  ...CRYPTO_BANNED_COUNTRIES,
];

export const MERCURYO_EXCLUDED_COUNTRIES = [
  'EC',
  'KG',
  'LB',
  'LY',
  'PS',
  'SO',
  'ZW',
  'KH',
  'SA',
  'AO',
  'BI',
  'CF',
  'GW',
  'LR',
  'ML',
  'SL',
  'SS',
  'SD',
  'TD',
  'CD',
  'CG',
  'DJ',
  'ER',
  'ET',
  'GN',
  'HT',
  'MM',
  'NI',
  'VE',
  'YE',
  'PK',
  'LK',
  'TJ',
  'TM',
] as const;

export const MERCURYO_ALL_RESTRICTED: string[] = [
  ...ALL_RESTRICTED_COUNTRIES,
  ...MERCURYO_EXCLUDED_COUNTRIES,
];

const DEFAULT_TRANSFI_PROHIBITED_COUNTRIES = ['UA', 'RU', 'BY'];

/**
 * Countries TransFi will not onboard, so its local-currency cash deposits are
 * not offered there. Read from EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES so the
 * list can follow TransFi's without a code change; their published list is at
 * https://docs.transfi.com/docs/prohibited-countries.
 *
 * This is the floor baked into the build. The admin dashboard (Config →
 * Countries) can add to it at runtime — see `useTransfiProhibitedCountries` —
 * but never take a country off it.
 */
export const TRANSFI_PROHIBITED_COUNTRIES: string[] =
  EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES === undefined
    ? DEFAULT_TRANSFI_PROHIBITED_COUNTRIES
    : EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES.split(',')
        .map((code: string) => code.trim().toUpperCase())
        .filter(Boolean);

/**
 * Whether TransFi is hidden in this country: on the build's list, or on
 * `dashboardCountries` — the list set on the admin dashboard, upper-cased.
 */
export function isTransfiProhibitedCountry(
  countryCode: string | undefined,
  dashboardCountries: readonly string[] = [],
): boolean {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  return TRANSFI_PROHIBITED_COUNTRIES.includes(code) || dashboardCountries.includes(code);
}

export type FeatureType = 'swap' | 'bridge' | 'buyCrypto' | 'bankTransfer' | 'card';

export function isCountryRestricted(countryCode: string, feature: FeatureType): boolean {
  const code = countryCode.toUpperCase();

  switch (feature) {
    case 'buyCrypto':
      return MERCURYO_ALL_RESTRICTED.includes(code);
    case 'card':
      return true;
    default:
      return ALL_RESTRICTED_COUNTRIES.includes(code);
  }
}

export const RESTRICTION_NOTICE = {
  title: 'Not Available in Your Region',
  subtitle: 'This feature is not available in your country due to regulatory requirements.',
} as const;
