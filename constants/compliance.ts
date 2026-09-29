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
 */
export const TRANSFI_PROHIBITED_COUNTRIES: string[] =
  EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES === undefined
    ? DEFAULT_TRANSFI_PROHIBITED_COUNTRIES
    : EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES.split(',')
        .map((code: string) => code.trim().toUpperCase())
        .filter(Boolean);

export function isTransfiProhibitedCountry(countryCode: string | undefined): boolean {
  return !!countryCode && TRANSFI_PROHIBITED_COUNTRIES.includes(countryCode.toUpperCase());
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
