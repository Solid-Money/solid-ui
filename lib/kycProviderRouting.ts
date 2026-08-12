import { getProviderRouting } from '@/lib/api';
import { detectGeo } from '@/lib/geo';
import { KycProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export interface ResolvedKycProvider {
  kycProvider: KycProvider;
  /** The country the decision was made on — `undefined` when it stayed unknown. */
  countryCode?: string;
}

/**
 * The country to route the KYC provider on, read at call time.
 *
 * Reading the store here rather than through a `useCountryStore` selector is
 * what makes this safe to call straight after the card country gate: the gate
 * persists the country it just resolved, but the React tree has not re-rendered
 * yet when the entry point invokes the KYC action, so any country captured in a
 * render closure is still the pre-gate one (i.e. `null` for a new user).
 *
 * Falls back to an IP lookup for the entry points that run no gate at all
 * (`FinishSetupModal`, and the `skipCountryGate` path in `CardWaitingModal`).
 * The detected country is deliberately NOT written back to the store —
 * `countryInfo.isAvailable` means *card* availability and only
 * `resolveCountryAccess` knows that answer. `detectGeo` memoises per session, so
 * this costs nothing once the gate has run.
 */
const resolveRoutingCountry = async (): Promise<string | undefined> => {
  const stored = useCountryStore.getState().countryInfo?.countryCode;
  if (stored) return stored;

  return (await detectGeo())?.countryCode;
};

/**
 * Resolve which identity provider the user's jurisdiction routes to — Wirex
 * countries → Sumsub, everywhere else → Didit.
 *
 * The backend owns the geography (GET /sumsub/provider-routing), so it can move
 * without an app release. Never throws: an unknown country or an unreachable
 * backend keeps `fallbackProvider`, which defaults to Didit because Didit is
 * available everywhere.
 *
 * @param fallbackProvider provider to keep when the country or routing is
 *   unavailable — the buy-crypto flow passes the backend's own suggestion here.
 */
export const resolveKycProvider = async (
  fallbackProvider: KycProvider = KycProvider.DIDIT,
): Promise<ResolvedKycProvider> => {
  const countryCode = await resolveRoutingCountry();

  if (!countryCode) return { kycProvider: fallbackProvider };

  try {
    const routing = await withRefreshToken(() => getProviderRouting(countryCode));
    return { kycProvider: routing?.kycProvider ?? fallbackProvider, countryCode };
  } catch {
    // backend unavailable → keep the fallback
    return { kycProvider: fallbackProvider, countryCode };
  }
};
