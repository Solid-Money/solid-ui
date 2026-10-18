import { useEffect, useMemo, useState } from 'react';

import { useCardSpendable } from '@/hooks/useCardSpendable';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { CardTransaction, CardTransactionCategory } from '@/lib/types';
import { declinedPaymentFigures, Money } from '@/lib/utils/cardCurrency';
import { isInsufficientDecline } from '@/lib/utils/cardDeclineReason';
import { useHomePromptStore } from '@/store/useHomePromptStore';

/** How recent a decline has to be for Home to bring it up. */
const DECLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The declined payment the Home banner is about (Figma 28856:9595). */
export interface DeclinedPaymentPrompt {
  /** Card transaction id — what the banner's "Fix it" opens. */
  transactionId: string;
  payment: Money;
  /** What the card can spend now, live — less than {@link payment}, or there is no banner. */
  available: Money;
  merchantName?: string;
}

const timeOf = (row: CardTransaction): number => {
  const time = new Date(row.authorized_at || row.posted_at).getTime();
  return Number.isFinite(time) ? time : 0;
};

/**
 * The payment a Wirex cardholder was declined for in the last day that their balance still does
 * not cover, or `null`.
 *
 * Three things make a decline stop being news, and each one hides the banner:
 *
 * - **It is covered.** The live balance now pays for it, so there is nothing left to fix — only
 *   the shop to ask again, which the receipt says.
 * - **A purchase went through after it.** The cardholder added funds and paid, or paid somewhere
 *   else; either way they have moved on, and a balance spent since then would otherwise read as
 *   the old decline still being short.
 * - **They closed it.** Per payment, so the next decline is still shown.
 *
 * Off (`enabled: false`) for anyone but a Wirex cardholder: the same reads cost nothing then.
 */
export const useDeclinedPaymentPrompt = (enabled: boolean): DeclinedPaymentPrompt | null => {
  const dismissedDeclines = useHomePromptStore(state => state.dismissedDeclines);
  // Same query keys the wallet screen already reads, so these are cache hits.
  const { data: transactions } = useCardTransactions({ enabled });
  const { data: spendable } = useCardSpendable({ enabled });
  // When the decline on show left its day, set the moment it does. Home can stay mounted for
  // longer than that with nothing refetching, and the banner must not outlive its window just
  // because the data it was picked from did not change.
  const [checkedAt, setCheckedAt] = useState(0);

  const shown = useMemo(() => {
    if (!enabled || !spendable) return null;

    const now = Math.max(Date.now(), checkedAt);
    const purchases = (transactions?.pages ?? [])
      .flatMap(page => page.data)
      .filter(row => row.category === CardTransactionCategory.PURCHASE)
      .sort((a, b) => timeOf(b) - timeOf(a));

    const lastSuccess = purchases.find(row => row.status !== 'declined');
    const declined = purchases.find(
      row =>
        row.status === 'declined' &&
        now - timeOf(row) < DECLINE_WINDOW_MS &&
        timeOf(row) > (lastSuccess ? timeOf(lastSuccess) : 0) &&
        isInsufficientDecline(row) &&
        !dismissedDeclines?.[row.id],
    );
    if (!declined) return null;

    const { payment, available, comparable } = declinedPaymentFigures(declined, spendable);
    if (!available || !comparable || comparable.available >= comparable.payment) return null;

    return {
      prompt: {
        transactionId: declined.id,
        payment,
        available,
        merchantName: declined.merchant_name?.trim() || declined.description?.trim() || undefined,
      },
      expiresAt: timeOf(declined) + DECLINE_WINDOW_MS,
    };
  }, [enabled, spendable, transactions?.pages, dismissedDeclines, checkedAt]);

  const expiresAt = shown?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return;
    // A second past the edge, so the re-check lands on the far side of it.
    const timer = setTimeout(
      () => setCheckedAt(Date.now()),
      Math.max(0, expiresAt - Date.now()) + 1000,
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);

  return shown?.prompt ?? null;
};

export default useDeclinedPaymentPrompt;
