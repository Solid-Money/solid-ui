import type { CardCreditSummary, ReferralV4Summary } from '@/lib/types';

/**
 * Whether a reward has been credited since the user last saw it — the moment
 * the Rewards tab icon "pops" (Figma motion, section 29541:13149).
 *
 * "Newest" is read from what the app already loads, one mark per source: the
 * card credit summary's grants, and the referral summary's credited bonuses
 * (either side of an invite, and earlier-program rewards paid to the user) and
 * spend share paid. The summary dates no
 * spend-share payment, so the total paid so far stands in for one: it only
 * ever grows, a payment at a time.
 */

/** Each source's newest reward; null while that source hasn't loaded. */
export interface RewardMarks {
  /** The newest card credit grant, epoch ms; 0 when there is none. */
  cardCreditAt: number | null;
  /** The newest referral reward credited or paid to the user, epoch ms; 0 when there is none. */
  referralCreditAt: number | null;
  /** The spend share paid to the user so far, USD. */
  spendSharePaidUsd: number | null;
}

type RewardMarkKey = keyof RewardMarks;

/** The marks the user has seen, per source. A source that never loaded has none. */
export type SeenRewardMarks = Partial<Record<RewardMarkKey, number>>;

const MARK_KEYS: readonly RewardMarkKey[] = [
  'cardCreditAt',
  'referralCreditAt',
  'spendSharePaidUsd',
];

/** How far past the seen mark counts as new: half a cent of float noise is not a payment. */
const NEW_BEYOND: Record<RewardMarkKey, number> = {
  cardCreditAt: 0,
  referralCreditAt: 0,
  spendSharePaidUsd: 0.005,
};

const timeOf = (iso: string | null | undefined): number => {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

const newest = (times: number[]): number => times.reduce((max, time) => Math.max(max, time), 0);

const isCredited = (status: string | undefined) => status === 'credited' || status === 'paid';

/** The newest reward each source shows right now. */
export const rewardMarks = (
  credit: CardCreditSummary | null | undefined,
  summary: ReferralV4Summary | null | undefined,
): RewardMarks => {
  const cardCreditAt = credit
    ? newest((credit.sources ?? []).map(source => timeOf(source?.createdAt)))
    : null;

  if (!summary) return { cardCreditAt, referralCreditAt: null, spendSharePaidUsd: null };

  const { rewards, asFriend, friends } = summary;
  // The referrer's side is in the reward events; the user's own invite is on `asFriend`.
  const credited = [
    ...(rewards?.welcome?.events ?? []),
    ...(rewards?.bigSpender?.events ?? []),
    ...(rewards?.upgrade?.events ?? []),
    asFriend?.welcome,
    asFriend?.bigSpender,
  ]
    .filter(reward => reward && isCredited(reward.status))
    .map(reward => timeOf(reward?.creditedAt));
  // Friends still on the earlier program are paid their own way, dated `paidAt`.
  const legacyPaid = (friends ?? []).map(friend => timeOf(friend?.legacy?.paidAt));
  const paid = rewards?.spendShare?.earnedUsd;

  return {
    cardCreditAt,
    referralCreditAt: newest([...credited, ...legacyPaid]),
    spendSharePaidUsd: typeof paid === 'number' && Number.isFinite(paid) ? paid : null,
  };
};

/**
 * True when any source shows a reward newer than the user has seen. A source
 * with nothing seen yet never counts: it is being loaded for the first time —
 * a fresh install, a new account on this device, an endpoint that has just
 * come up — and whatever it already holds is old news.
 */
export const hasNewReward = (marks: RewardMarks, seen: SeenRewardMarks | undefined): boolean =>
  MARK_KEYS.some(key => {
    const current = marks[key];
    const last = seen?.[key];
    return current !== null && last !== undefined && current > last + NEW_BEYOND[key];
  });

/**
 * The seen marks once the user has seen (or been shown) `marks`: every loaded
 * source moves up to its current mark, and never back down, so a figure that
 * briefly reads lower can't make an old reward pop again. Null when nothing
 * changes, so callers can skip the write.
 */
export const acknowledgeRewardMarks = (
  seen: SeenRewardMarks | undefined,
  marks: RewardMarks,
): SeenRewardMarks | null => {
  let next: SeenRewardMarks | null = null;
  for (const key of MARK_KEYS) {
    const current = marks[key];
    const last = seen?.[key];
    if (current === null || (last !== undefined && last >= current)) continue;
    next = { ...(next ?? seen), [key]: current };
  }
  return next;
};
