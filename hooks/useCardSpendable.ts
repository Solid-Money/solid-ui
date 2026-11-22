import { useQuery } from '@tanstack/react-query';

import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { getCardSpendable } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export const CARD_SPENDABLE_QUERY_KEY = 'cardSpendable';

/**
 * What a Wirex card can spend from its cash balance, in dollars and in the card's own currency
 * (`GET /wirex/spendable`).
 *
 * The figures `useCardDetails` carries in `balances`, read without the Wirex calls
 * that response makes — so the declined receipt can poll it while the cardholder
 * adds funds. The decline surfaces use this alongside the card's active spend mode.
 *
 * Wirex cards only: a Rain card is prefunded and has a balance of its own.
 */
export const useCardSpendable = ({
  enabled = true,
  refetchInterval,
}: { enabled?: boolean; refetchInterval?: number | false } = {}) => {
  const { user } = useUser();
  const { provider } = useCardProvider();

  return useQuery({
    queryKey: [CARD_SPENDABLE_QUERY_KEY, user?.userId],
    queryFn: () => withRefreshToken(() => getCardSpendable()),
    enabled: enabled && !!user?.userId && provider === CardProvider.WIREX,
    staleTime: 15_000,
    refetchInterval,
    // A 503 means the chain could not be read; one retry covers a blip without
    // holding the receipt's figure in a loading state.
    retry: 1,
  });
};

export default useCardSpendable;
