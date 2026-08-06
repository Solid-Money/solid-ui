import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { path } from '@/constants/path';
import { resolveCardCountry } from '@/lib/cardCountryGate';

/**
 * Mount-time card country gate for `/card/activate`.
 *
 * Runs {@link resolveCardCountry} once and, unless the card is available where
 * the user is, replaces the route with the country selection screen so they can
 * pick a country by hand.
 */
export function useCountryCheck(options?: { skip?: boolean }) {
  const router = useRouter();
  const skip = options?.skip ?? false;
  const [checkingCountry, setCheckingCountry] = useState(!skip);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (skip) {
      setCheckingCountry(false);
      return;
    }

    if (hasChecked.current) return;
    hasChecked.current = true;

    let cancelled = false;

    const run = async () => {
      const result = await resolveCardCountry('card_activate');

      if (cancelled) return;

      if (result === 'supported') {
        setCheckingCountry(false);
      } else {
        // Stay in the checking state through the redirect so the activate
        // screen never flashes behind the country selection screen.
        router.replace(path.CARD_COUNTRY_SELECTION);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, skip]);

  return { checkingCountry };
}
