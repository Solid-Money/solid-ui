import { useMemo } from 'react';

import { CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { useBalances } from '@/hooks/useBalances';
import { sumCardSpendableUSD } from '@/lib/utils/cardSpendable';

/**
 * USD of the user's own holdings that a card with no balance of its own can
 * spend — the "Spendable" figure in the home balance breakdown. What counts is
 * `CARD_SPENDABLE_ASSETS`.
 *
 * Reads the token balances the screen has already loaded (same query key as
 * `useWalletTokens`), so it costs no extra network work.
 *
 * This is spending *power*, not granted permission: it says what the card can
 * reach, and deliberately does not subtract an allowance the user has yet to
 * authorize or a purchase the issuer has authorized but not settled. Those belong
 * to the card screen, where the authorization is granted — showing them here would
 * make a fully funded account read as $0 spendable for the seconds before its
 * allowance query lands.
 */
export const useCardSpendableBalanceUSD = (): { data: number; isLoading: boolean } => {
  const { tokens, isLoading } = useBalances();

  const data = useMemo(() => sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS), [tokens]);

  return { data, isLoading };
};

export default useCardSpendableBalanceUSD;
