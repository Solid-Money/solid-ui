import { useEffect, useState } from 'react';

import { detectGeo } from '@/lib/geo';
import { useCountryStore } from '@/store/useCountryStore';

/**
 * The lookup's outcome, shared across every mount for the session.
 *
 * `detectGeo` already memoises the request, but each hook instance still began
 * unsettled and had to wait a microtask for the cached promise — so arriving at
 * a later screen gated its config call off for a frame and flashed empty
 * amounts. Holding the settled result here lets a second mount start with the
 * answer already in hand.
 */
let sessionGeo: { countryCode: string; region?: string } | undefined;
let sessionSettled = false;

/** Test seam: the module cache would otherwise leak between cases. */
export const __resetGeoSessionCache = () => {
  sessionGeo = undefined;
  sessionSettled = false;
};

/**
 * Whether the Cash App / Lightning deposit can be offered here.
 *
 * United States only. This is not our restriction to relax: Cash App's own
 * Lightning send and receive is US-only, and Orchestra additionally excludes
 * New York City. Offering the row anywhere else produces an invoice the user
 * has no way to pay.
 *
 * The country comes from the store when it is already known — a manual pick on
 * the country screen, or a recent IP detection — and otherwise from a fresh
 * lookup. `detectGeo` memoises per session and never throws, so this costs one
 * request at most and returns `null` rather than failing when every provider is
 * unreachable.
 *
 * An unresolved country is treated as **not** available: a deposit method that
 * flickers into view once geo resolves is worse than one that appears a beat
 * late, and "we could not tell where you are" is not a reason to offer a
 * US-only rail.
 */
export const useCashAppDepositAvailability = () => {
  const countryInfo = useCountryStore(state => state.countryInfo);
  const storedCode = countryInfo?.countryCode;
  const [detected, setDetected] = useState(sessionGeo);
  /**
   * Whether the lookup has finished, separately from whether it found anything.
   *
   * These are different answers and callers need to tell them apart: "we don't
   * know yet" must not be acted on, while "we looked and couldn't tell" is a
   * real, final answer. Conflating them let a caller treat the first render —
   * before detectGeo resolves — as a country the user isn't in.
   */
  const [isSettled, setIsSettled] = useState(sessionSettled);

  useEffect(() => {
    if (storedCode || sessionSettled) {
      setIsSettled(true);
      return;
    }
    let cancelled = false;
    void detectGeo().then(geo => {
      // The cache is set even if this instance unmounted — the answer is the
      // session's, not this component's.
      if (cancelled) {
        sessionGeo = geo ? { countryCode: geo.countryCode, region: geo.region } : undefined;
        sessionSettled = true;
        return;
      }
      sessionGeo = geo ? { countryCode: geo.countryCode, region: geo.region } : undefined;
      // Settled either way: a failed lookup is an answer, not a pending one.
      sessionSettled = true;
      if (geo) setDetected(sessionGeo);
      setIsSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storedCode]);

  const countryCode = (storedCode ?? detected?.countryCode)?.toUpperCase();
  const region = countryInfo?.state ?? detected?.region;

  return {
    isAvailable: countryCode === 'US',
    /** True while the lookup is still in flight; nothing should be decided yet. */
    isResolving: !isSettled,
    /** False while the country is still being resolved. */
    isResolved: Boolean(countryCode),
    countryCode,
    /** State/province where the provider resolved one. Unreliable over VPN. */
    region,
  };
};

export default useCashAppDepositAvailability;
