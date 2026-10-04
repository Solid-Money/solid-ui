import { ActivityEvent, Cashback } from '@/lib/types';

/**
 * Keeping cashback payouts out of the wallet feed.
 *
 * Cashback is paid as its own on-chain soUSD transfer from the payout wallet to
 * the cardholder's Safe, roughly two weeks after the purchase that earned it.
 * The feed indexes that transfer like any other incoming one, so each payout
 * turns up as a bare "Receive soUSD" row that says nothing about what it is —
 * and a day's worth of card purchases produces a day's worth of them.
 *
 * The card row the cashback was earned on already shows the figure (see
 * `getCashbackAmount`), so the payout row is pure noise. Until the payouts are
 * bundled into one labelled daily entry, it is hidden.
 *
 * Matching is by payout hash, taken from the cashback records themselves,
 * rather than by sender address: the same wallet also pays cardholder cash
 * credits, which are their own thing and must stay visible. It is also why this
 * needs no issuer branch — Rain and Wirex cashback are the same records in the
 * same collection, paid by the same wallet to the same Safe, so the one rule
 * covers both providers (and campaign cashback, which pays the same way).
 */

/** What `payoutTxHash` holds when a row was settled against debt, not paid. */
const DEDUCTED_FROM_DEBT = 'deducted_from_debt';

/**
 * A comparable transaction hash, or undefined when the value is not one.
 *
 * The sentinel above and any other non-hash value are rejected rather than
 * normalized, so a cashback that never produced a transfer cannot match an
 * activity that carries no hash either.
 */
const normalizeHash = (hash: string | undefined | null): string | undefined => {
  const normalized = hash?.trim().toLowerCase();
  if (!normalized || normalized === DEDUCTED_FROM_DEBT) return undefined;
  return normalized.startsWith('0x') ? normalized : undefined;
};

/** Every on-chain payout the cardholder's cashback rows account for. */
export const collectCashbackPayoutHashes = (cashbacks: Cashback[] | undefined): Set<string> => {
  const hashes = new Set<string>();

  for (const cashback of cashbacks ?? []) {
    const hash = normalizeHash(cashback.payoutTxHash);
    if (hash) hashes.add(hash);
  }

  return hashes;
};

/** Whether this wallet activity is one of those payouts landing. */
export const isCashbackPayoutActivity = (
  activity: ActivityEvent,
  payoutHashes: Set<string>,
): boolean => {
  if (payoutHashes.size === 0) return false;

  const hash = normalizeHash(activity.hash) ?? normalizeHash(activity.metadata?.txHash);
  return !!hash && payoutHashes.has(hash);
};
