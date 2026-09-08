/**
 * Client-side constants for the `SolidCashModule` card registration flow.
 *
 * All USD values here are 6-decimal integers, matching the module's `USD_DECIMALS`
 * and `SolidPriceProvider.PRICE_DECIMALS`. They are `bigint` rather than `number`
 * because they are passed straight into `registerSafe` as `uint256`.
 */

/** Decimals every USD amount and limit in the module is expressed in. */
export const CASH_USD_DECIMALS = 6;

/** One dollar, at {@link CASH_USD_DECIMALS}. */
export const ONE_USD = 1_000_000n;

/**
 * Daily-limit choices offered during setup, in whole dollars.
 *
 * Presets rather than a free-text field: the value has to satisfy three on-chain
 * constraints at once (`daily <= monthly`, `daily <= maxDailyLimitUsd`,
 * `monthly <= maxMonthlyLimitUsd`), and a typo that trips one of them costs the user
 * a failed transaction. The list is filtered against the live org ceilings before
 * being shown, so an option that would revert is never offered.
 *
 * $1,000 is the floor by choice, and it has two consequences worth knowing:
 *
 *  - A cardholder at or above it cannot pick a *tighter* cap here. Lowering is the
 *    risk-reducing direction and the one the module lets a user take unilaterally and
 *    instantly, so the picker no longer exposes all of it. Anyone already stored below
 *    the floor keeps their own rung, which `RegisterSpendAction` injects into the list.
 *  - An org daily ceiling under $1,000 now leaves *nothing* offerable, and
 *    {@link activationDailyLimit} returning null blocks card activation outright. A
 *    sub-$1,000 ceiling is therefore no longer usable as a staged-rollout throttle.
 */
export const DAILY_LIMIT_PRESETS_USD = [1_000, 5_000, 10_000, 25_000] as const;

/**
 * The daily limit card activation registers with, in whole dollars.
 *
 * The activation button enables the module in the press that creates the card, so it
 * cannot stop to ask, and the two directions of a later change are not symmetric:
 * lowering this is immediate and entirely in the user's hands, while raising it waits out
 * `limitRaiseDelay`. Starting low would therefore lock a new cardholder out of their own
 * card for a day the first time they spend more than the amount nobody asked them about
 * — the failure they cannot fix quickly. So this is the working default, and the sheet is
 * where anyone who wants less says so.
 *
 * Clamped by the caller against the live org ceilings, which are the real bound on what
 * a Safe may ever grant.
 *
 * Deliberately the *top* of {@link DAILY_LIMIT_PRESETS_USD} rather than a middle rung. Be
 * clear about what that trades: one activation signature grants the module this much a day
 * from the user's Safe, without them having picked the number. It buys the thing the raise
 * path cannot — a cardholder never meets a wall they have to sign and wait to move — and
 * the two directions are not symmetric, so the mistake worth avoiding is the one that is
 * slow to fix. Lowering is instant and entirely theirs; raising costs a signature plus
 * `limitRaiseDelay`.
 */
export const INITIAL_DAILY_LIMIT_USD = 25_000;

/**
 * Monthly limit as a multiple of the chosen daily limit.
 *
 * A single knob rather than two: independent daily and monthly inputs make it easy to
 * pick a monthly below the daily, which the module rejects outright
 * (`DailyLimitCannotBeGreaterThanMonthlyLimit`). Deriving one from the other makes
 * that state unreachable in the UI.
 */
export const MONTHLY_LIMIT_MULTIPLIER = 10n;

/**
 * The monthly cap that goes with a chosen daily one, kept on the same side of the
 * current pair as the daily move.
 *
 * At registration this is just ten times the daily. Afterwards it has to respect how the
 * contract validates a change: `decreaseSpendingLimit` rejects a monthly that went *up*
 * and `requestSpendingLimitIncrease` one that went *down*, so a derived monthly that
 * crosses the stored one in the opposite direction reverts the whole call. That only
 * happens when the stored pair are not ten times apart — a Safe that took the org
 * defaults — but it is exactly the Safe whose limits nobody has touched yet.
 *
 * Shared by the hook that signs and the sheet that previews, so the number shown is the
 * number sent.
 *
 * @param nextDailyUsd chosen daily cap, on-chain scale
 * @param current the caps in force, or null before the Safe is registered
 */
export const monthlyLimitFor = (
  nextDailyUsd: bigint,
  current?: { dailyLimitUsd: bigint; monthlyLimitUsd: bigint } | null,
): bigint => {
  const derived = nextDailyUsd * MONTHLY_LIMIT_MULTIPLIER;
  if (!current) return derived;
  if (nextDailyUsd === current.dailyLimitUsd) return current.monthlyLimitUsd;

  return nextDailyUsd > current.dailyLimitUsd
    ? derived > current.monthlyLimitUsd
      ? derived
      : current.monthlyLimitUsd
    : derived < current.monthlyLimitUsd
      ? derived
      : current.monthlyLimitUsd;
};

/** Widest offset `SpendingLimitLib.initialize` accepts, in seconds. */
const MAX_TIMEZONE_OFFSET_SECONDS = 24 * 60 * 60;

/**
 * The device's UTC offset in seconds, for `registerSafe`'s `timezoneOffset`.
 *
 * This fixes when the user's rolling daily and monthly windows reset, so that a
 * "daily limit" matches the day they experience rather than a UTC day. It is written
 * once at registration and there is no setter, so it is derived from the device
 * rather than asked for — a user cannot meaningfully answer it and a wrong answer is
 * permanent.
 *
 * `getTimezoneOffset()` returns minutes *west* of UTC (positive for the Americas),
 * which is the opposite sign to the contract's convention, hence the negation:
 * Kolkata reports -330 and the module wants +19800.
 *
 * Two known limitations, both accepted rather than worked around:
 *  - No DST. The offset is a fixed integer captured at registration, so a zone that
 *    observes DST is an hour out for part of the year. The window still resets once a
 *    day; only the hour drifts.
 *  - A traveller keeps the offset of wherever they registered.
 */
export const getDeviceTimezoneOffsetSeconds = (): number => {
  const offset = -new Date().getTimezoneOffset() * 60;

  // A hostile or broken environment could report anything; the contract would revert
  // with InvalidTimezoneOffset, so clamp to UTC rather than spend a failed user op.
  if (!Number.isFinite(offset) || Math.abs(offset) > MAX_TIMEZONE_OFFSET_SECONDS) return 0;

  // `|| 0` normalises -0, which UTC produces via the negation above. Harmless on-chain
  // (BigInt(-0) is 0n) but it reads as "-0" wherever the value is logged or compared.
  return Math.trunc(offset) || 0;
};

/** Whole dollars to a 6-decimal on-chain amount. */
export const usdToOnChain = (dollars: number): bigint => BigInt(Math.round(dollars)) * ONE_USD;

/** A 6-decimal on-chain amount to whole dollars, rounded down. */
export const onChainToUsd = (amount: bigint): number => Number(amount / ONE_USD);

/**
 * The presets the module would actually accept, given the live org ceilings.
 *
 * Both bounds have to be checked, not just the daily one: the monthly is derived from
 * the daily, so a preset can clear `maxDailyLimitUsd` and still revert with
 * `ExceedsOrgMonthlyCeiling`. An option that reverts is worse than an option that is
 * not offered, and this is the one place that decision is made — the setup sheet and
 * the activation flow both read it, so they cannot drift into offering different sets.
 */
export const offerableDailyPresets = (limits: {
  maxDailyLimitUsd: bigint;
  maxMonthlyLimitUsd: bigint;
}): number[] =>
  DAILY_LIMIT_PRESETS_USD.filter(dollars => {
    const daily = usdToOnChain(dollars);
    return (
      daily <= limits.maxDailyLimitUsd &&
      daily * MONTHLY_LIMIT_MULTIPLIER <= limits.maxMonthlyLimitUsd
    );
  });

/**
 * The daily cap card activation registers with, clamped to what the org actually allows.
 *
 * {@link INITIAL_DAILY_LIMIT_USD} clamped *downwards* — never upwards. A ceiling below
 * the default is the org saying this account may not have that much, so the answer is
 * the largest offer underneath it rather than the nearest one; overshooting would only
 * revert with `ExceedsOrgDailyCeiling`.
 *
 * `null` means no preset is open that the module would accept — and for a card that
 * spends from the Safe, nothing to grant means nothing worth issuing. Before the
 * ceilings have been read there is nothing to clamp against, so the plain default stands
 * in; the activation path re-reads them before it signs, so that copy only ever decides
 * what the screen says.
 *
 * Shared by the screen that previews the cap and the press that registers it, so the
 * number shown is the number sent.
 */
export const activationDailyLimit = (
  limits: { maxDailyLimitUsd: bigint; maxMonthlyLimitUsd: bigint } | null | undefined,
): number | null =>
  !limits
    ? INITIAL_DAILY_LIMIT_USD
    : (offerableDailyPresets(limits)
        .filter(dollars => dollars <= INITIAL_DAILY_LIMIT_USD)
        .at(-1) ?? null);

/**
 * Formats a 6-decimal USD amount for display, without cents when it is a round dollar.
 * `1_000_000n` renders as "$1,000" and `1_500_000n` as "$1,000.50".
 */
export const formatUsd = (amount: bigint): string => {
  const dollars = Number(amount) / Number(ONE_USD);
  // Both bounds move together: a currency amount with cents wants exactly two of them,
  // so 1_000_500_000n reads as "$1,000.50" and not "$1,000.5".
  const fractionDigits = Number.isInteger(dollars) ? 0 : 2;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/**
 * A delay in seconds as the coarse phrase a waiting user actually needs — "24 hours",
 * "2 days". Deliberately coarse: `limitRaiseDelay` is org configuration in round units,
 * and rendering it to the minute would imply a precision the countdown does not have
 * (the increase matures on the first block after the activation time, not on the tick).
 */
export const formatDelayDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'shortly';

  const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return plural(Math.max(1, minutes), 'minute');

  const hours = Math.round(minutes / 60);
  if (hours < 48) return plural(hours, 'hour');

  return plural(Math.round(hours / 24), 'day');
};

/**
 * A unix-seconds instant as a local date and time, for "your new limit starts ...".
 *
 * An absolute moment rather than a countdown: the sheet does not re-render on a timer,
 * so "in 11 hours" would quietly go stale while it sits open, and a wrong countdown on
 * a screen about spending permissions is worse than a slightly formal date.
 */
export const formatActivationTime = (unixSeconds: bigint | number): string =>
  new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
