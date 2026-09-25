import { useEffect, useState } from 'react';

import { detectGeo } from '@/lib/geo';
import { useCountryStore } from '@/store/useCountryStore';

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
  const [detected, setDetected] = useState<{ countryCode: string; region?: string }>();

  useEffect(() => {
    if (storedCode) return;
    let cancelled = false;
    void detectGeo().then(geo => {
      if (cancelled || !geo) return;
      setDetected({ countryCode: geo.countryCode, region: geo.region });
    });
    return () => {
      cancelled = true;
    };
  }, [storedCode]);

  const countryCode = (storedCode ?? detected?.countryCode)?.toUpperCase();
  const region = countryInfo?.state ?? detected?.region;

  return {
    isAvailable: countryCode === 'US',
    /** False while the country is still being resolved. */
    isResolved: Boolean(countryCode),
    countryCode,
    /** State/province where the provider resolved one. Unreliable over VPN. */
    region,
  };
};

export default useCashAppDepositAvailability;
