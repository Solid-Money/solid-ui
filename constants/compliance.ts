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
