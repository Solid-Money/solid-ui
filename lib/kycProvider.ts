import { KycProvider } from '@/lib/types';

/**
 * Local fallback list of jurisdictions routed to the Sumsub/Wirex flow: EU-27 +
 * EEA (IS, LI, NO) + UK + CH. The backend (GET /accounts/v1/sumsub/provider-routing)
 * is the authoritative source (env-driven WIREX_SUPPORTED_COUNTRIES); this list
 * is only used when that call is unavailable, and can be overridden at build
 * time with EXPO_PUBLIC_WIREX_COUNTRIES (comma-separated ISO alpha-2 codes).
 */
const DEFAULT_WIREX_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
];

function wirexCountrySet(): Set<string> {
  const override = process.env.EXPO_PUBLIC_WIREX_COUNTRIES;
  const codes =
    override && override.trim()
      ? override
          .split(/[,\s]+/)
          .map((c: string) => c.trim().toUpperCase())
          .filter(Boolean)
      : DEFAULT_WIREX_COUNTRIES;
  return new Set(codes);
}

/** Whether a country is served by the Wirex/Sumsub flow (local fallback). */
export function isWirexCountry(countryCode?: string | null): boolean {
  if (!countryCode) return false;
  return wirexCountrySet().has(countryCode.trim().toUpperCase());
}

/**
 * Resolve the KYC provider for a jurisdiction (local fallback). EU/EEA → Sumsub,
 * everywhere else → Didit. Prefer the backend routing endpoint when reachable.
 */
export function resolveKycProviderForCountry(countryCode?: string | null): KycProvider {
  return isWirexCountry(countryCode) ? KycProvider.SUMSUB : KycProvider.DIDIT;
}
