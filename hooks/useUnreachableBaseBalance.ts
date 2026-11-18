import { useMemo } from 'react';

import { useBalances } from '@/hooks/useBalances';
import { useCardSpendDeployments, useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { UnreachableBaseHolding, unreachableBaseHoldings } from '@/lib/utils/cardSpendable';

/** Below this the Base balance is dust, not something to turn Base on for. */
const MIN_UNREACHABLE_BASE_USD = 1;

const NONE = { holdings: [] as UnreachableBaseHolding[], usd: 0 };

/**
 * Dollars and crypto on Base the card cannot spend yet, because this cardholder never turned the
 * Base instance on.
 *
 * Until Oct 2026 the only way onto Base was euro spending, so a cardholder who never wanted euros
 * never enabled it — and every token added to Base since (USDC, USDT, cbBTC, …) has been out of
 * their card's reach. One was declined nine times with 37 USDC sitting on Base. Which tokens count
 * is the backend's Base allowlist, so this follows it as tokens are added.
 *
 * EURC and soEUR are left to {@link useUnusableEurc}: turning those on is the Main currency
 * page's decision, and they pay euro purchases only. Non-zero only while Base is still on offer
 * (`shouldOffer`), and only once the holdings are worth {@link MIN_UNREACHABLE_BASE_USD}.
 *
 * Read from the balances the screen already holds, so asking costs no request.
 */
export const useUnreachableBaseBalance = () => {
  const euroSpend = useEuroSpendEnablement();
  const { tokens } = useBalances();
  const { data } = useCardSpendDeployments();

  return useMemo(() => {
    if (!euroSpend.shouldOffer) return NONE;

    const holdings = unreachableBaseHoldings(tokens, data?.deployments).filter(
      holding => !holding.euroOnly,
    );
    const usd = holdings.reduce((total, holding) => total + holding.valueUSD, 0);

    return usd >= MIN_UNREACHABLE_BASE_USD ? { holdings, usd } : NONE;
  }, [euroSpend.shouldOffer, tokens, data?.deployments]);
};

export default useUnreachableBaseBalance;
