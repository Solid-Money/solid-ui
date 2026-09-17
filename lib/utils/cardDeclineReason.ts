import { CardSpendDetails, CardTransaction } from '@/lib/types';
/**
 * `toTitleCase` from `@/lib/utils`, inlined.
 *
 * Not imported: that barrel re-exports `multicall`, which pulls in wagmi's ESM
 * build, and the module the function itself lives in imports AsyncStorage at load.
 * Either would drag a native dependency into what is otherwise a pure lookup — and
 * into anything that tests it. One expression is the cheaper of the two costs.
 *
 * Sentence case rather than title case, matching the original exactly: the issuer's
 * reasons arrive as "insufficient funds", and capitalising each word would render a
 * value this row has shown in one style since it existed.
 */
const sentenceCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Our own decline vocabulary, as row-sized labels.
 *
 * Short noun phrases rather than the backend's full sentences, because of where
 * this lands: a right-aligned value in a card of plain facts, sized for the
 * issuer's own "Insufficient funds". The actionable version — "try a smaller
 * amount", "open the app to resume it" — is already delivered by the decline push,
 * which is read at the terminal where the user can still act on it. What the
 * receipt has to do is name the cause correctly.
 *
 * Mirrored here rather than read off the wire: `spend_details.decline_reason`
 * carries the raw code, and the wording is product copy that belongs beside the
 * rest of the app's, reviewable and localisable in this repo.
 *
 * Only the codes the user can do something about appear. The rest — a paused
 * module, a dead price feed, an RPC timeout — are ours, not theirs: naming our
 * internal machinery on a cardholder's receipt is noise, so those fall through to
 * the issuer's own reason instead (see {@link cardDeclineReason}).
 */
const DECLINE_CODE_LABEL: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Insufficient balance',
  EXCEEDS_PER_TX_LIMIT: 'Over per-payment limit',
  VELOCITY_LIMIT: 'Spending limit reached',
  EXPOSURE_CAP: 'Payments still settling',
  IN_ARREARS: 'Paused: earlier payment unsettled',
  SAFE_PAUSED: 'Card spending paused',
  SAFE_NOT_REGISTERED: 'Card setup incomplete',
  MODULE_NOT_ENABLED: 'Card spending not enabled',
};

/**
 * Why a card charge was declined, in the most specific terms we have.
 *
 * Prefers our own decline code over the issuer's reason, because the issuer's is
 * lossy in exactly the way that generates support tickets: four different internal
 * causes — no balance, the per-transaction cap, the exposure cap, a velocity limit —
 * all reach the card network as `InsufficientFunds`. A cardholder told "insufficient
 * funds" while looking at a funded balance has been given a wrong answer, and it was
 * our decision, not the network's, that produced it.
 *
 * Falls back to the issuer's reason whenever ours adds nothing: a code we have no
 * wording for, one of the internal codes above, or a decline the issuer made on its
 * own side that never reached our authorization endpoint at all (a blocked card, an
 * unsupported merchant), where there is no `spend_details` record to read. So the row
 * is never emptier than it is today — only more precise where we know more.
 *
 * @returns the label to show, or `undefined` when neither side gave a reason.
 */
export const cardDeclineReason = (
  transaction: Pick<CardTransaction, 'declined_reason'> & {
    spend_details?: Pick<CardSpendDetails, 'decline_reason'>;
  },
): string | undefined => {
  const code = transaction.spend_details?.decline_reason?.trim().toUpperCase();
  const ours = code ? DECLINE_CODE_LABEL[code] : undefined;
  if (ours) return ours;

  const theirs = transaction.declined_reason?.trim();

  return theirs ? sentenceCase(theirs) : undefined;
};

export default cardDeclineReason;
