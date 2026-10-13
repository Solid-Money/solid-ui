import { useMemo } from 'react';

import { useCardStatus } from '@/hooks/useCardStatus';
import { useCashbacks } from '@/hooks/useCashbacks';
import { hasCard } from '@/lib/utils';
import { collectCashbackPayoutHashes } from '@/lib/utils/cashbackActivity';

/**
 * The on-chain payouts behind the cardholder's cashback, for the feeds that
 * hide those rows — see `lib/utils/cashbackActivity`.
 *
 * Gated on the cardholder actually having a card, matching every other caller
 * of `useCashbacks`: someone with no card has no cashback and no payout rows to
 * hide, so the request is not worth making. The query is shared, so asking for
 * it from several lists costs one fetch.
 */
export function useCashbackPayoutHashes(): Set<string> {
  const { data: cardStatus } = useCardStatus();
  const { data: cashbacks } = useCashbacks({ enabled: hasCard(cardStatus) });

  return useMemo(() => collectCashbackPayoutHashes(cashbacks), [cashbacks]);
}
