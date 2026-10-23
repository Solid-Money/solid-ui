import { useMemo } from 'react';

import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { useBalances } from '@/hooks/useBalances';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';
import { cardSpendableAssetsFor, sumCardSpendableUSD } from '@/lib/utils/cardSpendable';

/**
 * The assets this cardholder's card can spend: the Fuse set, plus EURC on Base once they
 * have enabled euro spending. See `cardSpendableAssetsFor`.
 *
 * Until the deployment list answers this is the Fuse set alone, so the figure can rise
 * when it lands but never shows EURC to someone who has not enabled it.
 */
export const useCardSpendableAssets = (): CardSpendableAsset[] => {
  const { data } = useCardSpendDeployments();

  return useMemo(() => cardSpendableAssetsFor(data?.deployments), [data?.deployments]);
};

/**
 * USD of the user's own holdings that a card with no balance of its own can
 * spend — the "Spendable" figure in the home balance breakdown. What counts is
 * {@link useCardSpendableAssets}.
 *
 * Reads the token balances the screen has already loaded (same query key as
 * `useWalletTokens`), so it costs no extra network work.
 *
 * This is spending *power*, not granted permission: it says what the card could
 * reach, and deliberately does not subtract the on-chain caps a user has yet to
 * register for, or a purchase the issuer has authorized but not settled. Those
 * belong to the card screen, where the permission is granted — showing them here
 * would make a fully funded account read as $0 spendable for the seconds before its
 * registration query lands.
 *
 * Loading until the deployment list first answers, too. Balances are restored from disk on
 * launch, so without this the figure read the Fuse set alone — a euro cardholder's dollar
 * cents — and then jumped to the full balance when the list landed.
 *
 * "Not yet answered" is pending while fetching or paused: a launch offline pauses the query,
 * and `isLoading` alone reads a paused query as settled. A failed list is an answer — the
 * query leaves pending — and the figure falls back to the Fuse set, which the card can always
 * reach. A disabled query (no user yet) is idle and does not hold the figure.
 */
export const useCardSpendableBalanceUSD = (): { data: number; isLoading: boolean } => {
  const { tokens, isLoading } = useBalances();
  const { isPending, fetchStatus } = useCardSpendDeployments();
  const assets = useCardSpendableAssets();

  const data = useMemo(() => sumCardSpendableUSD(tokens, assets), [tokens, assets]);
  const isDeploymentsUnanswered = isPending && fetchStatus !== 'idle';

  return { data, isLoading: isLoading || isDeploymentsUnanswered };
};

export default useCardSpendableBalanceUSD;
