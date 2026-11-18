import { useMemo } from 'react';

import { useBalances } from '@/hooks/useBalances';
import { useCardSpendDeployments, useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { baseEurcHeld } from '@/lib/utils/cardSpendable';

/**
 * EURC on Base the card cannot spend yet. Main currency is where that changes.
 *
 * Non-zero only while euro spending is still on offer to this Wirex cardholder
 * (`shouldOffer`): once it is on, the same EURC is part of what the card spends
 * and there is nothing to say about it. Five of the people declined on Oct 15 were
 * holding EURC this way, and nothing in the app told them why it did not count.
 *
 * Read from the balances the screen already holds, so asking costs no request.
 */
export const useUnusableEurc = () => {
  const euroSpend = useEuroSpendEnablement();
  const { tokens } = useBalances();
  const { data } = useCardSpendDeployments();

  const eurc = useMemo(
    () => (euroSpend.shouldOffer ? baseEurcHeld(tokens, data?.deployments) : 0),
    [euroSpend.shouldOffer, tokens, data?.deployments],
  );

  return { eurc };
};

export default useUnusableEurc;
