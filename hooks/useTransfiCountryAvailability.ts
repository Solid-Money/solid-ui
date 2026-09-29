import { isTransfiProhibitedCountry } from '@/constants/compliance';
import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';

/**
 * Whether TransFi's local-currency cash deposits can be offered here.
 *
 * Reuses the Cash App hook's country resolution — the stored country when there
 * is one, otherwise a session-memoised geo lookup. Nothing is offered while the
 * lookup is in flight, so a user in a prohibited country never gets a tap in
 * before it lands. A lookup that settles with no country is not a reason to
 * hide the rows; TransFi still refuses the order server-side.
 */
export const useTransfiCountryAvailability = () => {
  const { countryCode, isResolving } = useCashAppDepositAvailability();

  return {
    isAvailable: !isResolving && !isTransfiProhibitedCountry(countryCode),
    isResolving,
  };
};

export default useTransfiCountryAvailability;
