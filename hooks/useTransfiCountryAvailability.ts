import { useCallback } from 'react';

import { isTransfiProhibitedCountry } from '@/constants/compliance';
import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';
import { useTransfiProhibitedCountries } from '@/hooks/useTransfiProhibitedCountries';

/**
 * Whether TransFi's local-currency cash deposits can be offered here.
 *
 * Reuses the Cash App hook's country resolution — the stored country when there
 * is one, otherwise a session-memoised geo lookup. Nothing is offered while the
 * lookup is in flight, so a user in a prohibited country never gets a tap in
 * before it lands. A lookup that settles with no country is not a reason to
 * hide the rows; TransFi still refuses the order server-side.
 *
 * Prohibited means on the build's list or on the admin dashboard's, and the
 * dashboard's list is waited for the same way — on its first read and while a
 * list older than five minutes is read again — so a country closed there never
 * flashes its rows either.
 */
export const useTransfiCountryAvailability = () => {
  const { countryCode, isResolving: isResolvingCountry } = useCashAppDepositAvailability();
  const {
    countries: dashboardCountries,
    isFetching: isFetchingDashboard,
    fetchCountries,
  } = useTransfiProhibitedCountries();
  const isResolving = isResolvingCountry || isFetchingDashboard;

  /**
   * For a country the user has just confirmed, not the one resolved here.
   * Checked against the dashboard's list as it stands when called — waited for
   * if it is still loading — not the one this render saw: the caller has
   * usually awaited something since.
   */
  const checkCountryProhibited = useCallback(
    async (code: string | undefined) => isTransfiProhibitedCountry(code, await fetchCountries()),
    [fetchCountries],
  );

  return {
    isAvailable: !isResolving && !isTransfiProhibitedCountry(countryCode, dashboardCountries),
    isResolving,
    checkCountryProhibited,
  };
};

export default useTransfiCountryAvailability;
