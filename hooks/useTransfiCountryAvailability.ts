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
 * dashboard's list is waited for the same way, so a country closed there never
 * flashes its rows either.
 */
export const useTransfiCountryAvailability = () => {
  const { countryCode, isResolving: isResolvingCountry } = useCashAppDepositAvailability();
  const { countries: dashboardCountries, isLoading: isLoadingDashboard } =
    useTransfiProhibitedCountries();
  const isResolving = isResolvingCountry || isLoadingDashboard;

  /** For a country the user has just confirmed, not the one resolved here. */
  const isCountryProhibited = useCallback(
    (code: string | undefined) => isTransfiProhibitedCountry(code, dashboardCountries),
    [dashboardCountries],
  );

  return {
    isAvailable: !isResolving && !isCountryProhibited(countryCode),
    isResolving,
    isCountryProhibited,
  };
};

export default useTransfiCountryAvailability;
