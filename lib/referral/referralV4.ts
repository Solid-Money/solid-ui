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

/**
 * The only program numbers the app knows on its own: the launch terms (the
 * backend's `REFERRAL_V4_DEFAULTS`), for wording copy before `terms` has loaded
 * or when an older backend leaves a newer field out. Everything else the
 * screens say comes from `terms`.
 */
export const REFERRAL_V4_TERMS_FALLBACK = {
  spendShareRate: 0.01,
  /** Thursday — 0 is Sunday, as in `ReferralV4Terms['spendShare']['payoutWeekday']`. */
  payoutWeekday: 4,
  payoutHourUtc: 10,
  monthTwoFromDays: 30,
  monthTwoToDays: 60,
} as const;

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

/** The spend share rate, "1%" — the launch rate until the terms have loaded. */
const spendShareRate = (terms: ReferralV4Terms | null | undefined): string =>
  formatRate(terms?.spendShare?.rate ?? REFERRAL_V4_TERMS_FALLBACK.spendShareRate);

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const wholeInRange = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;

/**
 * The weekday the payout run lands on where the user is: "Thursday".
 *
 * The terms give the run's weekday (0 = Sunday) and hour in UTC, and a run late
 * on a UTC Thursday is already Friday further east — so the day is worked out in
 * the device's time zone. `utcOffsetMinutes` is east-positive (UTC+2 is 120);
 * it defaults to the device's and is only passed by tests.
 */
export const payoutWeekdayName = (
  terms: ReferralV4Terms | null | undefined,
  utcOffsetMinutes: number = -new Date().getTimezoneOffset(),
): string => {
  const weekday =
    wholeInRange(terms?.spendShare?.payoutWeekday, 0, 6) ??
    REFERRAL_V4_TERMS_FALLBACK.payoutWeekday;
  const hour =
    wholeInRange(terms?.spendShare?.payoutHourUtc, 0, 23) ??
    REFERRAL_V4_TERMS_FALLBACK.payoutHourUtc;
  const minutes = weekday * MINUTES_PER_DAY + hour * 60 + (utcOffsetMinutes || 0);
  const local = ((minutes % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
  return WEEKDAYS[Math.floor(local / MINUTES_PER_DAY)];
};

/** "Thursdays" — "paid Thursdays". */
export const payoutWeekdayPlural = (
  terms: ReferralV4Terms | null | undefined,
  utcOffsetMinutes?: number,
): string => `${payoutWeekdayName(terms, utcOffsetMinutes)}s`;

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
const DAYS_PER_MONTH = 30;

/**
 * When a friend's spending grows the bonus limit, from the terms' window of
 * days after signup: "in their second month" for days 30–60, the days
 * themselves for a window that isn't a whole month.
 */
export const monthTwoPhrase = (bonusLimit: ReferralV4Terms['bonusLimit'] | undefined): string => {
  let from = wholeInRange(bonusLimit?.monthTwoFromDays, 0, Number.MAX_SAFE_INTEGER);
  let to = wholeInRange(bonusLimit?.monthTwoToDays, 0, Number.MAX_SAFE_INTEGER);
  // The backend falls back to both defaults when the window is empty; so does this.
  if (from === null || to === null || to <= from) {
    from = REFERRAL_V4_TERMS_FALLBACK.monthTwoFromDays;
    to = REFERRAL_V4_TERMS_FALLBACK.monthTwoToDays;
  }
  const ordinal =
    to - from === DAYS_PER_MONTH && from % DAYS_PER_MONTH === 0
      ? ORDINALS[from / DAYS_PER_MONTH]
      : undefined;
  return ordinal
    ? `in their ${ordinal} month`
    : `between day ${from} and day ${to} after they join`;
};

/** Refer & Earn's note while payouts are switched off. Null while they run. */
export const pausedNote = (terms: ReferralV4Terms | null | undefined): string | null =>
  terms?.paused === true ? 'Payouts are paused for now — everything you earn is kept.' : null;

/** A reversed bonus, wherever one is shown: the label, and why. */
export const REVERSED_LABEL = 'Reversed';
export const REVERSED_REASON = 'The qualifying purchase was refunded.';
/** Both on one line, for list rows. */
export const REVERSED_ROW_TEXT = 'Reversed · the qualifying purchase was refunded';

/**
 * "$4 of this went to cover a reversed bonus" — under a bonus part of which
 * repaid one that was reversed. Null when none of it did.
 */
export const offsetNote = (offsetUsd: number | null | undefined): string | null =>
  typeof offsetUsd === 'number' && offsetUsd > 0
    ? `${formatUsdShort(offsetUsd)} of this went to cover a reversed bonus`
    : null;

/**
 * The one line Refer & Earn shows while the user owes back reversed bonuses.
 * Only what is still owed is known, so the bonus itself goes unpriced; and no
 * date — when an unrecovered debt is written off is never shown to users.
 * Null when nothing is owed.
 */
export const debtLine = (debt: ReferralV4Summary['debt']): string | null => {
  if (!debt || !(debt.remainingUsd > 0)) return null;
  const count = Math.max(1, Math.round(debt.reversedCount || 0));
  const reversed =
    count === 1
      ? 'A bonus was reversed because the qualifying purchase was refunded.'
      : `${count} bonuses were reversed because the qualifying purchases were refunded.`;
  return `${reversed} ${formatUsdShort(debt.remainingUsd)} will come out of your next rewards.`;
};

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
    return {
      text: `Earning ${spendShareRate(terms)} · +${formatUsdShort(row.spendShare.thisWeekUsd)} this week`,
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
  if ([row.welcome, row.bigSpender, row.upgrade].some(step => step.status === 'reversed')) {
    return { text: REVERSED_ROW_TEXT, tone: 'muted' };
  }
  if (row.stage === 'idle') return { text: 'No purchases this week', tone: 'muted' };
  return { text: 'Card active', tone: 'muted' };
};

export type RewardAmountTone = 'earned' | 'pending' | 'reversed';

export interface RewardStepLine {
  subtitle: string;
  /** A second, smaller line: why a bonus was reversed, or what part of it repaid one. */
  note: string | null;
  /** 0–1 when the row shows a progress bar. */
  progress: number | null;
  /** Earned amounts are green; anything not (or no longer) earned is dimmed. */
  amountTone: RewardAmountTone;
}

const isPaidOut = (status: ReferralV4RewardStatus) => status === 'credited' || status === 'paid';

const stepLine = (
  subtitle: string,
  amountTone: RewardAmountTone,
  extra: Partial<Pick<RewardStepLine, 'note' | 'progress'>> = {},
): RewardStepLine => ({ subtitle, note: null, progress: null, amountTone, ...extra });

/** The status lines every step shares, or null when the step needs its own. */
const commonStepLine = (
  status: ReferralV4RewardStatus,
  dates: { earnedAt?: string; creditedAt?: string; unlocksAt?: string },
): RewardStepLine | null => {
  switch (status) {
    case 'credited':
    case 'paid':
      return stepLine(
        `Earned ${formatShortDay(dates.earnedAt ?? dates.creditedAt)}`.trim(),
        'earned',
      );
    case 'on_hold':
      return stepLine(
        dates.unlocksAt ? `Unlocks ${formatShortDay(dates.unlocksAt)}` : 'Unlocking',
        'pending',
      );
    case 'limit_reached':
      return stepLine('Earned · paid when your bonus limit grows', 'pending');
    case 'under_review':
      return stepLine('Earned · in review', 'pending');
    case 'expired':
      return stepLine('Expired', 'pending');
    case 'excluded':
      return stepLine('Not available in their country', 'pending');
    case 'cancelled':
      return stepLine('Cancelled', 'pending');
    case 'reversed':
      return stepLine(REVERSED_LABEL, 'reversed', { note: REVERSED_REASON });
    default:
      return null;
  }
};

/** Adds the "went to cover a reversed bonus" note to a step that has one to show. */
const withOffsetNote = (current: RewardStepLine, step: { offsetUsd?: number }): RewardStepLine => {
  const note = current.note ?? offsetNote(step.offsetUsd);
  return note === current.note ? current : { ...current, note };
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
  if (common) return withOffsetNote(common, step);

  const target = step.targetUsd ?? terms?.welcome.spendTargetUsd ?? 0;
  const merchantTarget = step.merchantTarget ?? terms?.welcome.merchantTarget ?? 0;
  const days = daysUntil(step.deadlineAt, now);

  if (step.status === 'in_progress') {
    const parts = [
      `${formatUsdWhole(step.progressUsd ?? 0)} of ${formatUsdWhole(target)}`,
      merchantTarget > 0 ? `${step.merchantCount ?? 0} of ${merchantTarget} shops` : null,
      days === null ? null : formatDaysLeft(days),
    ].filter(Boolean);
    return stepLine(parts.join(' · '), 'pending', {
      progress: ratio(step.progressUsd, target),
    });
  }

  const windowDays = terms?.welcome.windowDays;
  return stepLine(
    `Spend ${formatUsdWhole(target)}${
      merchantTarget > 0 ? ` at ${merchantTarget} shops` : ''
    }${windowDays ? ` in ${windowDays} days` : ''}`,
    'pending',
  );
};

/** Friend detail: the big spender bonus row. */
export const bigSpenderStepLine = (
  step: ReferralV4StepView,
  terms?: ReferralV4Terms,
  now: number = Date.now(),
): RewardStepLine => {
  const common = commonStepLine(step.status, step);
  if (common) return withOffsetNote(common, step);

  const target = step.targetUsd ?? terms?.bigSpender.spendTargetUsd ?? 0;
  if (step.status === 'in_progress') {
    const days = daysUntil(step.deadlineAt, now);
    return stepLine(
      `${formatUsdWhole(step.progressUsd ?? 0)} of ${formatUsdWhole(target)}${
        days === null ? '' : ` · ${formatDaysLeft(days)}`
      }`,
      'pending',
      { progress: ratio(step.progressUsd, target) },
    );
  }

  const windowDays = terms?.bigSpender.windowDays;
  return stepLine(
    `Spend ${formatUsdWhole(target)}${windowDays ? ` in ${windowDays} days` : ''}`,
    'pending',
  );
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
    return withOffsetNote(stepLine(`Got ${tier}${day ? ` on ${day}` : ''}`, 'earned'), step);
  }

  const common = commonStepLine(step.status, step);
  if (common) return withOffsetNote(common, step);

  // The FUSE-lock route counts once the lock has held long enough.
  if (step.status === 'in_progress' && step.via === 'lock' && step.lockEligibleAt) {
    const days = daysUntil(step.lockEligibleAt, now);
    return stepLine(
      `${tier ?? 'FUSE'} lock · counts ${days ? `in ${days} ${plural(days, 'day', 'days')}` : 'soon'}`,
      'pending',
    );
  }

  return stepLine('When they get Prime or Ultra', 'pending');
};

/** Friend detail: the spend share row, paid on the terms' payout day. */
export const spendShareLine = (
  spendShare: { earnedUsd: number; thisWeekUsd: number },
  stage: ReferralV4FriendRow['stage'],
  terms?: ReferralV4Terms,
): RewardStepLine => {
  const paidOn = payoutWeekdayPlural(terms);
  return stepLine(
    stage === 'capped'
      ? 'Reached the limit for this friend'
      : spendShare.thisWeekUsd > 0
        ? `+${formatUsdShort(spendShare.thisWeekUsd)} this week · paid ${paidOn}`
        : `Paid ${paidOn}`,
    spendShare.earnedUsd > 0 ? 'earned' : 'pending',
  );
};

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

/**
 * The invited user's own bonus, on their Refer screen, once it was reversed:
 * "$10 welcome bonus · Reversed". Null when neither of theirs was.
 */
export const asFriendReversedLine = (
  asFriend: ReferralV4Summary['asFriend'],
): { step: 'welcome' | 'bigSpender'; text: string } | null => {
  if (!asFriend || asFriend.program !== 'v4') return null;
  const reversed = (
    [
      { step: 'welcome', view: asFriend.welcome, name: 'welcome bonus' },
      { step: 'bigSpender', view: asFriend.bigSpender, name: 'big spender bonus' },
    ] as const
  ).find(({ view }) => view?.status === 'reversed');
  return reversed
    ? {
        step: reversed.step,
        text: `${formatUsdWhole(reversed.view.amountUsd)} ${reversed.name} · ${REVERSED_LABEL}`,
      }
    : null;
};

/** Progress toward the per-friend cap, 0–1. */
export const capProgress = (row: Pick<ReferralV4FriendRow, 'earnedUsd' | 'capUsd'>): number =>
  ratio(row.earnedUsd, row.capUsd);
