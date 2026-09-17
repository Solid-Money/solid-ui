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
 * The rungs card *activation* is allowed to register a Safe at, in whole dollars.
 *
 * No longer a picker: `ManageCardSheet` takes a typed amount and validates it with
 * {@link spendLimitRejection}, so a cardholder choosing their own cap is not confined to
 * this list. What is left needs it is the activation press, which enables the module in
 * the same press that creates the card and so cannot stop to ask —
 * {@link activationDailyLimit} picks from here.
 *
 * $1,000 is the floor by choice, and it has one consequence worth knowing: an org daily
 * ceiling under $1,000 leaves *nothing* offerable, and {@link activationDailyLimit}
 * returning null blocks card activation outright. A sub-$1,000 ceiling is therefore not
 * usable as a staged-rollout throttle.
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
 * The monthly cap that goes with a chosen daily one.
 *
 * Only used where both caps have to be written at once and the user has named one: card
 * activation, and the first limit a cardholder sets. **Editing an existing cap never
 * calls this** — the two are stored independently and each moves on its own, so deriving
 * one from the other would move a number nobody touched.
 *
 * With no `current` — the only case left in the app — this is simply ten times the daily.
 * The `current` branch keeps a derived monthly on the same side of the stored pair as the
 * daily move, which is what the contract requires of a pair sent together
 * (`decreaseSpendingLimit` rejects a monthly that went *up*, `requestSpendingLimitIncrease`
 * one that went *down*); it is retained for any caller that does send both.
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

/**
 * The daily cap that goes with a chosen monthly one.
 *
 * Only needed before registration. There, `registerSafe` writes both caps at once and
 * either row may be the one the user edits, so a monthly limit chosen on its own still
 * has to produce a daily one — left at zero it would register a card that declines every
 * payment. Afterwards the caps are stored independently and the monthly moves alone, so
 * nothing derives a daily from it.
 *
 * The inverse of {@link MONTHLY_LIMIT_MULTIPLIER}, floored — but floored to the monthly
 * itself rather than to zero for a monthly under the multiplier, because zero is the one
 * answer that cannot be right and `daily <= monthly` still holds.
 */
export const dailyLimitFor = (nextMonthlyUsd: bigint): bigint => {
  const derived = nextMonthlyUsd / MONTHLY_LIMIT_MULTIPLIER;
  return derived > 0n ? derived : nextMonthlyUsd;
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
 * "Refreshes in 12 hours" for a rolling window's renewal instant.
 *
 * The module recomputes `dailyRenewalTimestamp` / `monthlyRenewalTimestamp` on every
 * read, so this is the one number that says when the headroom just spent comes back.
 * Coarse for the same reason {@link formatDelayDuration} is: the sheet does not
 * re-render on a timer, so a figure to the minute would quietly go stale while it sits
 * open.
 */
export const formatWindowRefresh = (renewalUnixSeconds: bigint | number): string => {
  const seconds = Number(renewalUnixSeconds) - Math.floor(Date.now() / 1000);
  // A window whose renewal instant has already passed is one the next read rolls over,
  // so there is no interval to name — only the fact that it is about to happen.
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Refreshes shortly';

  return `Refreshes in ${formatDelayDuration(seconds)}`;
};

/**
 * A typed limit as whole dollars, or null when there is no number in it.
 *
 * Digits only: a `$`, thousands separators and stray spaces are dropped rather than
 * rejected, and cents are not accepted at all — the caps here are whole-dollar
 * quantities on both sides of the wire, and "$1,000.50 a day" is a limit with a
 * rounding question attached rather than a limit anyone meant to set.
 */
export const parseUsdInput = (text: string): number | null => {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0) return null;

  const dollars = Number(digits);
  return Number.isSafeInteger(dollars) ? dollars : null;
};

/**
 * Why the module would refuse a move to these caps, or null when it would accept it.
 *
 * Shared by the field that validates before it lets the user press Confirm and the hook
 * that validates again before it signs, so a rejected value costs a message rather than
 * a failed user operation — and only ever one wording of it.
 *
 * The org ceilings are checked in the raising direction only, and deliberately so: an org
 * that lowers a ceiling below a cap it has already granted leaves cardholders sitting
 * above it, and those cardholders must still be able to come *down*. A ceiling check on a
 * decrease would be the one piece of validation that blocks the safe direction.
 *
 * @param current the caps in force
 * @param next the caps being asked for
 * @param ceilings the live org maximums
 */
export const spendLimitRejection = (
  current: { dailyLimitUsd: bigint; monthlyLimitUsd: bigint },
  next: { dailyLimitUsd: bigint; monthlyLimitUsd: bigint },
  ceilings: { maxDailyLimitUsd: bigint; maxMonthlyLimitUsd: bigint },
  /** Which cap the user is editing, so the one they are up against gets named. */
  editing: 'daily' | 'monthly' = 'daily',
): string | null => {
  if (next.dailyLimitUsd <= 0n || next.monthlyLimitUsd <= 0n) {
    return 'Enter an amount above zero.';
  }
  // `SpendingLimitLib` rejects this pair outright, in either direction. The two caps are
  // otherwise independent, so this is the one place one of them constrains the other —
  // and the message names the *other* cap, which is the number that has to move.
  if (next.dailyLimitUsd > next.monthlyLimitUsd) {
    return editing === 'daily'
      ? `Your daily limit cannot be above your monthly limit of ${formatUsd(next.monthlyLimitUsd)}.`
      : `Your monthly limit cannot be below your daily limit of ${formatUsd(next.dailyLimitUsd)}.`;
  }
  if (
    next.dailyLimitUsd > current.dailyLimitUsd &&
    next.dailyLimitUsd > ceilings.maxDailyLimitUsd
  ) {
    return `Your daily limit can be at most ${formatUsd(ceilings.maxDailyLimitUsd)}.`;
  }
  if (
    next.monthlyLimitUsd > current.monthlyLimitUsd &&
    next.monthlyLimitUsd > ceilings.maxMonthlyLimitUsd
  ) {
    return `Your monthly limit can be at most ${formatUsd(ceilings.maxMonthlyLimitUsd)}.`;
  }

  return null;
};
