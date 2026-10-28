import { ActivityEvent, Cashback } from '@/lib/types';
import { getTransferContext, TransferContextKind } from '@/lib/utils/transferPresentation';

/**
 * Keeping cashback payouts out of the wallet feed.
 *
 * Cashback is paid as its own on-chain transfer from the payout wallet to the
 * cardholder's Safe, roughly two weeks after the purchase that earned it. The
 * indexers skip soUSD, today's payout token, but every earlier FUSE payout was
 * indexed like any other incoming transfer: a bare "Receive FUSE" row that says
 * nothing about what it is, one per purchase. Any future payout token that is
 * indexed would land the same way.
 *
 * Cashback belongs to the purchase that earned it: the card transaction's own
 * screen shows it in its cashback section (`CashbackDetailsCard`), with the
 * figure, the rate and the day it paid out. So the payout is never a row of its
 * own — it is hidden from every list, and a link straight to it opens the
 * purchase instead (see {@link getCashbackPurchaseId}).
 *
 * There are two ways to tell a payout. The backend names one it matched to a
 * cashback record (`transferContext.kind` of `card_cashback`), which needs
 * nothing on the device and so holds while the cashback list is still loading,
 * and for a cardholder whose card has since closed — the list is only fetched
 * for an active card. The payout hashes from the list cover rows the backend
 * has not named yet.
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

const activityHash = (activity: ActivityEvent): string | undefined =>
  normalizeHash(activity.hash) ?? normalizeHash(activity.metadata?.txHash);

/** Whether this wallet activity is one of those payouts landing. */
export const isCashbackPayoutActivity = (
  activity: ActivityEvent,
  payoutHashes: Set<string>,
): boolean => {
  if (getTransferContext(activity)?.kind === TransferContextKind.CARD_CASHBACK) return true;
  if (payoutHashes.size === 0) return false;

  const hash = activityHash(activity);
  return !!hash && payoutHashes.has(hash);
};

/**
 * The card transaction a cashback payout was earned on, or undefined when this
 * activity is not a payout or the purchase is not known.
 *
 * The backend's label names it when it has one; otherwise it is the cashback
 * row the payout's hash belongs to.
 */
export const getCashbackPurchaseId = (
  activity: ActivityEvent,
  cashbacks: Cashback[] | undefined,
): string | undefined => {
  const context = getTransferContext(activity);
  if (context?.kind === TransferContextKind.CARD_CASHBACK && context.cardTransactionId) {
    return context.cardTransactionId;
  }

  const hash = activityHash(activity);
  if (!hash) return undefined;

  const cashback = cashbacks?.find(row => normalizeHash(row.payoutTxHash) === hash);
  return cashback?.transactionId || undefined;
};
