import { format } from 'date-fns';

import type {
  ReferralFriendStage,
  ReferralRewardListItem,
  ReferralV4FriendRow,
  ReferralV4RewardStatus,
  ReferralV4StepView,
  ReferralV4Summary,
  ReferralV4Terms,
  ReferralV4UpgradeView,
} from '@/lib/types';

/**
 * Pure presentation for the referral v4 screens: amounts, dates and the one
 * line of status each friend and each reward gets. Kept out of the components
 * so the copy can be tested against the contract's states without rendering.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the referral v4 program is live for this user. */
export const isReferralV4Live = (summary: ReferralV4Summary | null | undefined): boolean =>
  summary?.terms?.enabled === true;

/** "$2,000" — whole dollars, for terms and targets. */
export const formatUsdWhole = (value: number): string =>
  `$${Math.round(value || 0).toLocaleString('en-US')}`;

/** "$45.60" — dollars and cents, for money earned. */
export const formatUsdCents = (value: number): string =>
  `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$54" or "$3.50": cents only when there are any. */
export const formatUsdShort = (value: number): string => {
  const amount = Math.round((value || 0) * 100) / 100;
  return Number.isInteger(amount) ? formatUsdWhole(amount) : formatUsdCents(amount);
};

/** "1%" from 0.01; "1.5%" from 0.015. */
export const formatRate = (rate: number): string => `${Math.round((rate || 0) * 10000) / 100}%`;

const toDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "Thu, Oct 29" — the next payout. */
export const formatPayoutDay = (iso: string | null | undefined): string => {
  const date = toDate(iso);
  return date ? format(date, 'EEE, MMM d') : '';
};

/** "Sep 24". */
export const formatShortDay = (iso: string | null | undefined): string => {
  const date = toDate(iso);
  return date ? format(date, 'MMM d') : '';
};

/** Whole days until `iso`, rounded up; 0 once it has passed; null without a date. */
export const daysUntil = (
  iso: string | null | undefined,
  now: number = Date.now(),
): number | null => {
  const date = toDate(iso);
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - now) / DAY_MS));
};

/** "9 days left", "1 day left", "Last day". */
export const formatDaysLeft = (days: number): string =>
  days <= 0 ? 'Last day' : `${days} ${days === 1 ? 'day' : 'days'} left`;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Two letters for an avatar: "Ana R." → "AR", "dana" → "DA". */
export const friendInitials = (username: string | null | undefined): string => {
  const parts = (username ?? '')
    .split(/[\s._\-@]+/)
    .map(part => part.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

/** The name a friend row leads with. */
export const friendName = (username: string | null | undefined): string =>
  username?.trim() || 'Invited friend';

/** The part of a name before any surname — "earned from Ana". */
export const friendFirstName = (username: string | null | undefined): string =>
  friendName(username).split(/\s+/)[0];

export type FriendLineTone = 'accent' | 'muted';

export interface FriendStatusLine {
  text: string;
  tone: FriendLineTone;
}

/** What a step still needs, in the order a friend would read it. */
const welcomeRemaining = (step: ReferralV4StepView, terms?: ReferralV4Terms) => {
  const target = step.targetUsd ?? terms?.welcome.spendTargetUsd ?? 0;
  const merchantTarget = step.merchantTarget ?? terms?.welcome.merchantTarget ?? 0;
  return {
    spendLeft: Math.max(0, target - (step.progressUsd ?? 0)),
    shopsLeft: Math.max(0, merchantTarget - (step.merchantCount ?? 0)),
  };
};

/** "$54 to go for $10 each · 9 days left" / "2 more shops for $10 each". */
const welcomeProgressLine = (
  step: ReferralV4StepView,
  terms: ReferralV4Terms | undefined,
  now: number,
): string => {
  const { spendLeft, shopsLeft } = welcomeRemaining(step, terms);
  const reward = `${formatUsdWhole(step.amountUsd)} each`;
  const need =
    spendLeft > 0
      ? `${formatUsdShort(spendLeft)} to go`
      : shopsLeft > 0
        ? `${shopsLeft} more ${plural(shopsLeft, 'shop', 'shops')}`
        : 'Almost there';
  const days = daysUntil(step.deadlineAt, now);
  return `${need} for ${reward}${days === null ? '' : ` · ${formatDaysLeft(days)}`}`;
};

/** "$1,820 of $5,000 for $50 each". */
const bigSpenderProgressLine = (step: ReferralV4StepView, terms?: ReferralV4Terms): string => {
  const target = step.targetUsd ?? terms?.bigSpender.spendTargetUsd ?? 0;
  return `${formatUsdWhole(step.progressUsd ?? 0)} of ${formatUsdWhole(target)} for ${formatUsdWhole(
    step.amountUsd,
  )} each`;
};

/** Earned and waiting for the hold to end: "$10 unlocks Nov 12". */
const unlockingLine = (row: ReferralV4FriendRow): string | null => {
  const steps: { amountUsd: number; status: ReferralV4RewardStatus; unlocksAt?: string }[] = [
    row.welcome,
    row.bigSpender,
    row.upgrade,
  ];
  const holding = steps.find(step => step.status === 'on_hold' && step.unlocksAt);
  if (holding)
    return `${formatUsdWhole(holding.amountUsd)} unlocks ${formatShortDay(holding.unlocksAt)}`;
  if (steps.some(step => step.status === 'under_review')) return 'Bonus in review';
  if (steps.some(step => step.status === 'limit_reached')) return 'Bonus waiting on your limit';
  return null;
};

/** Today's lifecycle labels, the same ones the legacy friend row's chip uses. */
const LEGACY_STAGE_LABELS: Record<ReferralFriendStage, string> = {
  registered: 'No card',
  verifying: 'Verifying',
  card_ordered: 'Card not active',
  spending: 'Pending',
  reward_unlocking: 'Qualified',
  paid: 'Completed',
  expired: 'Expired',
  under_review: 'In review',
  reversed: 'Reversed',
} as Record<ReferralFriendStage, string>;

/** "Completed · $25 · soFUSE" — a friend on today's program, in today's words. */
export const legacyFriendLine = (legacy: ReferralRewardListItem | undefined): FriendStatusLine => {
  if (!legacy) return { text: 'Earlier program', tone: 'muted' };
  const label = LEGACY_STAGE_LABELS[legacy.stage] ?? 'Pending';
  const token = legacy.payoutToken ?? 'soFUSE';
  return {
    text: `${label} · ${formatUsdWhole(legacy.rewardUsd)} · ${token}`,
    tone: legacy.stage === ('paid' as ReferralFriendStage) ? 'accent' : 'muted',
  };
};

/**
 * The one line under a friend's name on "Your invites": what they are doing
 * for the referrer right now, or what they still need to do.
 */
export const friendStatusLine = (
  row: ReferralV4FriendRow,
  terms?: ReferralV4Terms,
  now: number = Date.now(),
): FriendStatusLine => {
  if (row.program === 'legacy') return legacyFriendLine(row.legacy);

  switch (row.stage) {
    case 'registered':
      return { text: 'Signed up · not verified yet', tone: 'muted' };
    case 'verifying':
      return { text: 'Verifying identity', tone: 'muted' };
    case 'card_ordered':
      return { text: 'Card not active yet', tone: 'muted' };
    case 'under_review':
      return { text: 'In review', tone: 'muted' };
    case 'reversed':
      return { text: 'Reversed', tone: 'muted' };
    case 'expired':
      return { text: 'Bonus window closed', tone: 'muted' };
    case 'capped':
      return { text: `Reached the ${formatUsdWhole(row.capUsd)} limit`, tone: 'accent' };
  }

  if (row.stage === 'earning') {
    const rate = terms ? formatRate(terms.spendShare.rate) : '1%';
    return {
      text: `Earning ${rate} · +${formatUsdShort(row.spendShare.thisWeekUsd)} this week`,
      tone: 'accent',
    };
  }
  if (row.welcome.status === 'in_progress') {
    return { text: welcomeProgressLine(row.welcome, terms, now), tone: 'muted' };
  }
  if (row.bigSpender.status === 'in_progress') {
    return { text: bigSpenderProgressLine(row.bigSpender, terms), tone: 'muted' };
  }
  const unlocking = unlockingLine(row);
  if (unlocking) return { text: unlocking, tone: 'muted' };
  if (row.stage === 'idle') return { text: 'No purchases this week', tone: 'muted' };
  return { text: 'Card active', tone: 'muted' };
};

export type RewardAmountTone = 'earned' | 'pending';

export interface RewardStepLine {
  subtitle: string;
  /** 0–1 when the row shows a progress bar. */
  progress: number | null;
  /** Earned amounts are green; anything not yet earned is dimmed. */
  amountTone: RewardAmountTone;
}

const isPaidOut = (status: ReferralV4RewardStatus) => status === 'credited' || status === 'paid';

/** The status lines every step shares, or null when the step needs its own. */
const commonStepLine = (
  status: ReferralV4RewardStatus,
  dates: { earnedAt?: string; creditedAt?: string; unlocksAt?: string },
): RewardStepLine | null => {
  switch (status) {
    case 'credited':
    case 'paid':
      return {
        subtitle: `Earned ${formatShortDay(dates.earnedAt ?? dates.creditedAt)}`.trim(),
        progress: null,
        amountTone: 'earned',
      };
    case 'on_hold':
      return {
        subtitle: dates.unlocksAt ? `Unlocks ${formatShortDay(dates.unlocksAt)}` : 'Unlocking',
        progress: null,
        amountTone: 'pending',
      };
    case 'limit_reached':
      return {
        subtitle: 'Earned · paid when your bonus limit grows',
        progress: null,
        amountTone: 'pending',
      };
    case 'under_review':
      return { subtitle: 'Earned · in review', progress: null, amountTone: 'pending' };
    case 'expired':
      return { subtitle: 'Expired', progress: null, amountTone: 'pending' };
    case 'excluded':
      return { subtitle: 'Not available in their country', progress: null, amountTone: 'pending' };
    case 'cancelled':
      return { subtitle: 'Cancelled', progress: null, amountTone: 'pending' };
    default:
      return null;
  }
};

const ratio = (progress: number | undefined, target: number | undefined) =>
  target && target > 0 ? Math.min(1, Math.max(0, (progress ?? 0) / target)) : 0;

/** Friend detail: the welcome bonus row. */
export const welcomeStepLine = (
  step: ReferralV4StepView,
  terms?: ReferralV4Terms,
  now: number = Date.now(),
): RewardStepLine => {
  const common = commonStepLine(step.status, step);
  if (common) return common;

  const target = step.targetUsd ?? terms?.welcome.spendTargetUsd ?? 0;
  const merchantTarget = step.merchantTarget ?? terms?.welcome.merchantTarget ?? 0;
  const days = daysUntil(step.deadlineAt, now);

  if (step.status === 'in_progress') {
    const parts = [
      `${formatUsdWhole(step.progressUsd ?? 0)} of ${formatUsdWhole(target)}`,
      merchantTarget > 0 ? `${step.merchantCount ?? 0} of ${merchantTarget} shops` : null,
      days === null ? null : formatDaysLeft(days),
    ].filter(Boolean);
    return {
      subtitle: parts.join(' · '),
      progress: ratio(step.progressUsd, target),
      amountTone: 'pending',
    };
  }

  const windowDays = terms?.welcome.windowDays;
  return {
    subtitle: `Spend ${formatUsdWhole(target)}${
      merchantTarget > 0 ? ` at ${merchantTarget} shops` : ''
    }${windowDays ? ` in ${windowDays} days` : ''}`,
    progress: null,
    amountTone: 'pending',
  };
};

/** Friend detail: the big spender bonus row. */
export const bigSpenderStepLine = (
  step: ReferralV4StepView,
  terms?: ReferralV4Terms,
  now: number = Date.now(),
): RewardStepLine => {
  const common = commonStepLine(step.status, step);
  if (common) return common;

  const target = step.targetUsd ?? terms?.bigSpender.spendTargetUsd ?? 0;
  if (step.status === 'in_progress') {
    const days = daysUntil(step.deadlineAt, now);
    return {
      subtitle: `${formatUsdWhole(step.progressUsd ?? 0)} of ${formatUsdWhole(target)}${
        days === null ? '' : ` · ${formatDaysLeft(days)}`
      }`,
      progress: ratio(step.progressUsd, target),
      amountTone: 'pending',
    };
  }

  const windowDays = terms?.bigSpender.windowDays;
  return {
    subtitle: `Spend ${formatUsdWhole(target)}${windowDays ? ` in ${windowDays} days` : ''}`,
    progress: null,
    amountTone: 'pending',
  };
};

const TIER_NAMES = { prime: 'Prime', ultra: 'Ultra' } as const;

/** Friend detail: the upgrade bonus row. */
export const upgradeStepLine = (
  step: ReferralV4UpgradeView,
  now: number = Date.now(),
): RewardStepLine => {
  const tier = step.tier ? TIER_NAMES[step.tier] : null;

  if (isPaidOut(step.status) && tier) {
    const day = formatShortDay(step.earnedAt ?? step.creditedAt);
    return {
      subtitle: `Got ${tier}${day ? ` on ${day}` : ''}`,
      progress: null,
      amountTone: 'earned',
    };
  }

  const common = commonStepLine(step.status, step);
  if (common) return common;

  // The FUSE-lock route counts once the lock has held long enough.
  if (step.status === 'in_progress' && step.via === 'lock' && step.lockEligibleAt) {
    const days = daysUntil(step.lockEligibleAt, now);
    return {
      subtitle: `${tier ?? 'FUSE'} lock · counts ${
        days ? `in ${days} ${plural(days, 'day', 'days')}` : 'soon'
      }`,
      progress: null,
      amountTone: 'pending',
    };
  }

  return { subtitle: 'When they get Prime or Ultra', progress: null, amountTone: 'pending' };
};

/** Friend detail: the spend share row. */
export const spendShareLine = (
  spendShare: { earnedUsd: number; thisWeekUsd: number },
  stage: ReferralV4FriendRow['stage'],
): RewardStepLine => ({
  subtitle:
    stage === 'capped'
      ? 'Reached the limit for this friend'
      : spendShare.thisWeekUsd > 0
        ? `+${formatUsdShort(spendShare.thisWeekUsd)} this week · paid Thursdays`
        : 'Paid Thursdays',
  progress: null,
  amountTone: spendShare.earnedUsd > 0 ? 'earned' : 'pending',
});

/**
 * The friend's own welcome progress, on the Refer screen of someone who was
 * invited: "Spend $54 more at 2 more shops in 9 days to get $10 card credit".
 * Null once there is nothing left to do (or nothing to do it for).
 */
export const asFriendProgressLine = (
  asFriend: ReferralV4Summary['asFriend'],
  terms?: ReferralV4Terms,
  now: number = Date.now(),
): string | null => {
  if (!asFriend || asFriend.program !== 'v4') return null;
  const step = asFriend.welcome;
  if (step.status !== 'in_progress' && step.status !== 'locked') return null;

  const { spendLeft, shopsLeft } = welcomeRemaining(step, terms);
  if (spendLeft <= 0 && shopsLeft <= 0) return null;

  const days = daysUntil(step.deadlineAt, now);
  const parts = [
    spendLeft > 0 ? `Spend ${formatUsdShort(spendLeft)} more` : 'Spend',
    shopsLeft > 0 ? `at ${shopsLeft} more ${plural(shopsLeft, 'shop', 'shops')}` : null,
    days === null ? null : days <= 0 ? 'today' : `in ${days} ${plural(days, 'day', 'days')}`,
    `to get ${formatUsdWhole(step.amountUsd)} card credit`,
  ].filter(Boolean);
  return parts.join(' ');
};

/** Progress toward the per-friend cap, 0–1. */
export const capProgress = (row: Pick<ReferralV4FriendRow, 'earnedUsd' | 'capUsd'>): number =>
  ratio(row.earnedUsd, row.capUsd);
