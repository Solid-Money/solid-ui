import { parseUnits } from 'viem';

import { isHigherTier } from '@/lib/rewardsUpgrade';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  RewardsTier,
  type TierBalanceRouteDto,
  type TierBalanceTier,
  type TierBalanceTrackDto,
  type TierMembershipState,
} from '@/lib/types';

/**
 * The "Hold in Earn" tier route: Prime or Ultra for keeping a USD balance in
 * Earn for a lookback period, next to the paid membership and the FUSE lock.
 *
 * Every rule and number here is the backend's. The thresholds, the lookback,
 * grace and re-entry periods and the shortfall all come in the payload, so an
 * admin changing one reaches every screen without a release — nothing in this
 * file, or in any copy built from it, may name an amount or a day count of its
 * own.
 *
 * The route involves no transaction, so it is not a `TierUpgradeRoute` and never
 * goes through the upgrade modal: its only action is adding money to Earn.
 */

/** The tiers the route can grant, lowest first. */
export const TIER_BALANCE_TIERS: readonly TierBalanceTier[] = [
  RewardsTier.PRIME,
  RewardsTier.ULTRA,
];

/**
 * The route's payload, when the app may show anything about it.
 *
 * Staged to the internal team: everyone else gets `balance: null`, and a backend
 * from before the route sends no field at all. Both, and a payload that is
 * present but not enabled, are the same answer — nothing new on any screen.
 */
export const activeTierBalance = (
  membership: Pick<TierMembershipState, 'balance'> | null | undefined,
): TierBalanceRouteDto | null =>
  membership?.balance?.enabled === true ? membership.balance : null;

/** One tier's track. */
export const tierBalanceTrack = (
  balance: TierBalanceRouteDto,
  tier: TierBalanceTier,
): TierBalanceTrackDto => (tier === RewardsTier.ULTRA ? balance.ultra : balance.prime);

const isHeld = (track: TierBalanceTrackDto) =>
  track.status === 'active' || track.status === 'grace';

/**
 * The track the app talks about, or null when there is nothing to say.
 *
 * A tier the route already holds comes first, Ultra over Prime. Otherwise the
 * lowest tier above the current one that is building, else simply the lowest
 * tier above the current one: Prime for a Core user, Ultra for a Prime user.
 * An Ultra member by another route has nothing above them to be nudged toward.
 */
export const relevantTrack = (
  balance: TierBalanceRouteDto | null | undefined,
  currentTier: RewardsTier | undefined,
): TierBalanceTrackDto | null => {
  if (!balance?.enabled) return null;
  if (isHeld(balance.ultra)) return balance.ultra;
  if (isHeld(balance.prime)) return balance.prime;

  const above = TIER_BALANCE_TIERS.filter(tier =>
    isHigherTier(tier, currentTier ?? RewardsTier.CORE),
  ).map(tier => tierBalanceTrack(balance, tier));
  return above.find(track => track.status === 'building') ?? above[0] ?? null;
};

/**
 * What moving money out of Earn would do to the relevant track.
 *
 * - `reset`: the tier is building, and the days held so far would start over.
 * - `grace`: the route holds the user's tier, and the drop would start its grace
 *   period — the tier ends unless the balance is back up before it runs out.
 * - `lose`: the route holds the user's tier and the drop ends it, either because
 *   the grace period is already running or because there is none.
 */
export type TierBalanceOutflowKind = 'lose' | 'grace' | 'reset';

export interface TierBalanceOutflowWarning {
  kind: TierBalanceOutflowKind;
  tier: TierBalanceTier;
  thresholdUsd: number;
  graceDays: number;
  /** When a running grace period ends, for `lose` in grace. */
  graceEndsAt: string | null;
  lookbackDays: number;
  /** Days already held toward the tier, for `reset`. */
  daysHeld: number;
  /** How long the route stays shut once a tier it held has ended, for `lose`. */
  reentryDays: number;
}

/**
 * The warning to show before `outflowUsd` leaves Earn, or null for none.
 *
 * Informational only — every flow lets the user carry on. Every track the
 * outflow would cross is weighed, not just the one the screens talk about:
 * - a tier the route holds, when the route is what holds the user's current
 *   tier and the balance after the outflow would be under its threshold —
 *   grace starts, or the tier ends; this comes first;
 * - otherwise a tier above the current one that is building and whose
 *   threshold the balance would fall under — its progress resets. A Prime
 *   member by balance building toward Ultra is warned about Ultra even while
 *   Prime stays funded. Of several, the lowest tier crossed is named.
 *
 * Nothing for an outflow of nothing (or one the form cannot price yet), and
 * nothing before the backend has measured a balance to subtract it from.
 */
export const outflowWarning = (
  balance: TierBalanceRouteDto | null | undefined,
  currentTier: RewardsTier | undefined,
  outflowUsd: number,
): TierBalanceOutflowWarning | null => {
  if (!Number.isFinite(outflowUsd) || outflowUsd <= 0) return null;
  if (!balance?.enabled || balance.currentUsd === null) return null;
  const after = balance.currentUsd - outflowUsd;
  const crosses = (track: TierBalanceTrackDto) => after < track.thresholdUsd;

  const warning = (
    track: TierBalanceTrackDto,
    kind: TierBalanceOutflowKind,
  ): TierBalanceOutflowWarning => ({
    kind,
    tier: track.tier,
    thresholdUsd: track.thresholdUsd,
    graceDays: balance.graceDays,
    graceEndsAt: track.graceEndsAt,
    lookbackDays: balance.lookbackDays,
    daysHeld: track.daysHeld,
    reentryDays: balance.reentryDays,
  });

  // A tier the route holds: the highest, Ultra over Prime.
  const held = isHeld(balance.ultra) ? balance.ultra : isHeld(balance.prime) ? balance.prime : null;
  if (held && balance.holdsCurrentTier && crosses(held)) {
    return warning(held, held.status === 'active' && balance.graceDays > 0 ? 'grace' : 'lose');
  }

  // Progress toward a tier above what the user holds, by any route.
  const floor = held ? held.tier : (currentTier ?? RewardsTier.CORE);
  const building = TIER_BALANCE_TIERS.filter(
    tier => isHigherTier(tier, floor) && isHigherTier(tier, currentTier ?? RewardsTier.CORE),
  )
    .map(tier => tierBalanceTrack(balance, tier))
    .find(track => track.status === 'building' && crosses(track));
  return building ? warning(building, 'reset') : null;
};

// ---------------------------------------------------------------------------
// Valuing what leaves Earn, in fixed point.
// ---------------------------------------------------------------------------

/** Decimals a price or rate is carried at once it becomes a bigint. */
const PRICE_DECIMALS = 12;

/**
 * A typed token amount as base units, or null when it is not a positive amount
 * the token can carry ("", "abc", "-1", more decimals than the token has).
 */
export const parseTokenUnits = (
  amount: string | undefined,
  decimals: number | undefined,
): bigint | null => {
  const trimmed = amount?.trim();
  if (!trimmed || decimals === undefined || !Number.isInteger(decimals) || decimals < 0) {
    return null;
  }
  try {
    const units = parseUnits(trimmed, decimals);
    return units > 0n ? units : null;
  } catch {
    return null;
  }
};

/** The precision {@link fixedPointUsd} returns: millionths of a dollar. */
const USD_MICROS = 1_000_000n;

/** A positive finite price or rate as a bigint at {@link PRICE_DECIMALS}, else null. */
const priceUnits = (price: number): bigint | null => {
  if (!Number.isFinite(price) || price <= 0) return null;
  try {
    return parseUnits(price.toFixed(PRICE_DECIMALS), PRICE_DECIMALS);
  } catch {
    return null;
  }
};

/**
 * The USD value of `units` base units of a token with `decimals`, at each of
 * `prices` in turn (USD per token, or a share's rate then the asset's USD
 * price), worked out in bigint so the token amount loses no precision before
 * it is compared with a threshold. The final figure keeps micro-dollars,
 * rounded up, so a sliver over a threshold's allowance still warns (round to
 * cents only for display). 0 for no units or any price that is not positive.
 */
export const fixedPointUsd = (
  units: bigint | null | undefined,
  decimals: number,
  ...prices: number[]
): number => {
  if (!units || units <= 0n || prices.length === 0) return 0;
  let value = units;
  let scale = 10n ** BigInt(decimals);
  for (const price of prices) {
    const fixed = priceUnits(price);
    if (fixed === null) return 0;
    value *= fixed;
    scale *= 10n ** BigInt(PRICE_DECIMALS);
  }
  // Ceiling division: understating an outflow could hide a warning.
  const micros = (value * USD_MICROS + scale - 1n) / scale;
  return Number(micros) / Number(USD_MICROS);
};

// ---------------------------------------------------------------------------
// Copy. Every figure in it comes from the payload.
// ---------------------------------------------------------------------------

const tierName = (tier: TierBalanceTier) => getTierDisplayName(tier);

/** "30 days" / "1 day". */
export const daysLabel = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;

const COMPACT_USD = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/** A threshold as running copy writes it: "$7.5K", "$35K", "$250". */
export const formatThresholdUsd = (amount: number): string => `$${COMPACT_USD.format(amount)}`;

/**
 * An amount still to add, rounded UP to the dollar so adding it always clears
 * the threshold: "$1,235".
 */
export const formatShortfallUsd = (amount: number): string =>
  `$${Math.ceil(Math.max(0, amount)).toLocaleString('en-US')}`;

/** A measured balance, rounded DOWN so it never reads as enough when it is not. */
export const formatBalanceUsd = (amount: number): string =>
  // Grouped whole dollars, never compact: compact formatting rounds to the
  // nearest step, so $7,299 would read "$7.3K" beside a $7.3K target.
  `$${Math.floor(Math.max(0, amount)).toLocaleString('en-US')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A route date as copy writes it: "Dec 24", with the year when it is not this
 * one. Empty for a missing or unreadable date.
 *
 * `qualifiesOn` is a UTC day ("2026-12-24"), not an instant: it is written as
 * that day wherever the reader is, where `new Date("2026-12-24")` would show
 * Dec 23 to anyone west of Greenwich. The other dates are instants, written in
 * the reader's own day.
 */
export const formatTierBalanceDate = (
  value: string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '';
  const day = DAY_KEY.exec(value);
  let year: number;
  let month: number;
  let date: number;
  if (day) {
    year = Number(day[1]);
    month = Number(day[2]) - 1;
    date = Number(day[3]);
  } else {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    year = parsed.getFullYear();
    month = parsed.getMonth();
    date = parsed.getDate();
  }
  if (!MONTHS[month]) return '';
  return year === now.getFullYear()
    ? `${MONTHS[month]} ${date}`
    : `${MONTHS[month]} ${date}, ${year}`;
};

/** "Hold $7.5K in Earn for 30 days". */
export const holdRequirementCopy = (
  track: TierBalanceTrackDto,
  balance: Pick<TierBalanceRouteDto, 'lookbackDays'>,
): string =>
  `Hold ${formatThresholdUsd(track.thresholdUsd)} in Earn for ${daysLabel(balance.lookbackDays)}`;

/** Days still to hold before a building track unlocks. */
const daysLeft = (track: TierBalanceTrackDto, lookbackDays: number) =>
  Math.max(0, lookbackDays - track.daysHeld);

/**
 * The one line that says where a track stands, by status:
 * - none: what is still missing, or what it takes when nothing is;
 * - building: how long the balance has to stay;
 * - active: that holding unlocked it;
 * - grace: by when to top up to keep it;
 * - cooldown: when the route opens again.
 */
export const trackStatusLine = (
  track: TierBalanceTrackDto,
  balance: Pick<TierBalanceRouteDto, 'currentUsd' | 'lookbackDays'>,
  now: Date = new Date(),
): string => {
  const name = tierName(track.tier);
  const threshold = formatThresholdUsd(track.thresholdUsd);
  const lookback = daysLabel(balance.lookbackDays);

  switch (track.status) {
    case 'building': {
      const date = formatTierBalanceDate(track.qualifiesOn, now);
      if (date) return `Keep it there until ${date} to unlock ${name}`;
      const left = daysLeft(track, balance.lookbackDays);
      return left > 0
        ? `Keep it there ${daysLabel(left)} more to unlock ${name}`
        : `Keep it there to unlock ${name}`;
    }
    case 'active':
      return `Unlocked by holding ${threshold} in Earn`;
    case 'grace': {
      const date = formatTierBalanceDate(track.graceEndsAt, now);
      return date
        ? `Top up to ${threshold} by ${date} to keep ${name}`
        : `Top up to ${threshold} to keep ${name}`;
    }
    case 'cooldown': {
      const date = formatTierBalanceDate(track.reentryAt, now);
      return date ? `Available again on ${date}` : 'Available again soon';
    }
    case 'none':
    default:
      if (balance.currentUsd !== null && track.shortfallUsd > 0) {
        return `Add ${formatShortfallUsd(track.shortfallUsd)} to Earn and keep it there ${lookback} to unlock ${name}`;
      }
      return `${holdRequirementCopy(track, balance)} to unlock ${name}`;
  }
};

/**
 * The Earn page's nudge: a headline ("$1,235 more unlocks Prime", "Top up to
 * keep Prime") and the line under it, which never repeats the headline.
 */
export const trackNudgeCopy = (
  track: TierBalanceTrackDto,
  balance: Pick<TierBalanceRouteDto, 'currentUsd' | 'lookbackDays'>,
  now: Date = new Date(),
): { title: string; body: string } => {
  const name = tierName(track.tier);
  const threshold = formatThresholdUsd(track.thresholdUsd);
  switch (track.status) {
    case 'building':
      return { title: `Unlocking ${name}`, body: trackStatusLine(track, balance, now) };
    case 'active':
      return {
        title: `${name} unlocked by holding`,
        body: `Keep ${threshold} or more in Earn to keep ${name}`,
      };
    case 'grace': {
      const date = formatTierBalanceDate(track.graceEndsAt, now);
      return {
        title: `Top up to keep ${name}`,
        body: date
          ? `Your Earn balance is under ${threshold}. Top it up by ${date}.`
          : `Your Earn balance is under ${threshold}.`,
      };
    }
    case 'cooldown':
      return { title: `${name} by holding`, body: trackStatusLine(track, balance, now) };
    case 'none':
    default:
      return {
        title:
          balance.currentUsd !== null && track.shortfallUsd > 0
            ? `${formatShortfallUsd(track.shortfallUsd)} more unlocks ${name}`
            : `Unlock ${name} by holding`,
        body: `${holdRequirementCopy(track, balance)} to unlock ${name}`,
      };
  }
};

/** Whether a track's next step is adding money to Earn. */
export const trackNeedsTopUp = (track: TierBalanceTrackDto): boolean =>
  track.status === 'none' || track.status === 'grace';

/** The progress bar beside a track: days for a building track, dollars otherwise. */
export interface TierBalanceProgress {
  /** 0..100. */
  percent: number;
  /** The figure reached, or null when there is none to show yet. */
  value: string | null;
  /** The figure aimed at, written to follow `value`: "/$7.5K", "/30 days". */
  target: string;
}

const clampPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

export const trackProgress = (
  track: TierBalanceTrackDto,
  balance: Pick<TierBalanceRouteDto, 'currentUsd' | 'lookbackDays'>,
): TierBalanceProgress => {
  if (track.status === 'building' && balance.lookbackDays > 0) {
    return {
      percent: clampPercent((track.daysHeld / balance.lookbackDays) * 100),
      value: String(track.daysHeld),
      target: `/${daysLabel(balance.lookbackDays)}`,
    };
  }
  return {
    percent: track.status === 'active' ? 100 : clampPercent(track.progressPct),
    value: balance.currentUsd === null ? null : formatBalanceUsd(balance.currentUsd),
    target: `/${formatThresholdUsd(track.thresholdUsd)}`,
  };
};

/** The words of an outflow warning. */
export const outflowWarningCopy = (
  warning: TierBalanceOutflowWarning,
  now: Date = new Date(),
): { title: string; body: string } => {
  const name = tierName(warning.tier);
  const threshold = formatThresholdUsd(warning.thresholdUsd);
  const reentry =
    warning.reentryDays > 0
      ? ` Holding can't unlock it again for ${daysLabel(warning.reentryDays)} after that.`
      : '';

  switch (warning.kind) {
    case 'reset':
      return {
        title: `This restarts your progress to ${name}`,
        body:
          warning.daysHeld > 0
            ? `Your Earn balance would drop below ${threshold}, and your ${daysLabel(warning.daysHeld)} toward ${name} would start over. It takes ${daysLabel(warning.lookbackDays)} at ${threshold} or more to unlock it.`
            : `Your Earn balance would drop below ${threshold}. It takes ${daysLabel(warning.lookbackDays)} at ${threshold} or more to unlock ${name}.`,
      };
    case 'grace':
      return {
        title: `This puts your ${name} tier at risk`,
        body: `Your Earn balance would drop below ${threshold}. You'd have up to ${daysLabel(warning.graceDays)} to bring it back up before ${name} ends.${reentry}`,
      };
    case 'lose':
    default: {
      const date = formatTierBalanceDate(warning.graceEndsAt, now);
      return {
        title: `You could lose ${name}`,
        body: date
          ? `Your Earn balance would stay below ${threshold}. ${name} ends on ${date} unless it's back above ${threshold} by then.${reentry}`
          : `Your Earn balance would drop below ${threshold}, which ends ${name}.${reentry}`,
      };
    }
  }
};

/** The balance celebration: true when the route is what just gave the user `tier`. */
export const unlockedByBalance = (
  balance: TierBalanceRouteDto | null | undefined,
  tier: RewardsTier,
): boolean =>
  !!balance?.enabled &&
  balance.holdsCurrentTier &&
  balance.grantsTier === tier &&
  tier !== RewardsTier.CORE;

/** Where an outflow warning was shown, for analytics. */
export type TierBalanceOutflowFlow = 'withdraw' | 'send' | 'swap' | 'card_topup';
