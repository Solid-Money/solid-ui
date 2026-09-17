import {
  activationDailyLimit,
  DAILY_LIMIT_PRESETS_USD,
  formatDelayDuration,
  formatUsd,
  getDeviceTimezoneOffsetSeconds,
  INITIAL_DAILY_LIMIT_USD,
  MONTHLY_LIMIT_MULTIPLIER,
  monthlyLimitFor,
  offerableDailyPresets,
  onChainToUsd,
  ONE_USD,
  usdToOnChain,
} from '@/constants/cardSpendModule';

/**
 * The filter the setup sheet and the activation flow both offer limits through, called
 * the way they call it. Exercised here rather than through the sheet so the constraint
 * is tested without rendering anything.
 */
const offerablePresets = (maxDailyLimitUsd: bigint, maxMonthlyLimitUsd: bigint) =>
  offerableDailyPresets({ maxDailyLimitUsd, maxMonthlyLimitUsd });

describe('getDeviceTimezoneOffsetSeconds', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockOffset = (minutes: number) => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(minutes);
  };

  // The sign flip is the whole point of the helper. `getTimezoneOffset` counts minutes
  // *west* of UTC, the contract counts seconds *east*, so getting this wrong writes a
  // permanent, unchangeable offset with the window resetting at the wrong end of the day.
  it('negates the JS convention: Kolkata reports -330 and the module wants +19800', () => {
    mockOffset(-330);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(19_800);
  });

  it('gives New York (UTC-5) a negative offset', () => {
    mockOffset(300);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(-18_000);
  });

  it('gives UTC zero', () => {
    mockOffset(0);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(0);
  });

  // SpendingLimitLib.initialize reverts InvalidTimezoneOffset outside +/-24h, so a
  // broken environment must cost a UTC window rather than a failed user operation.
  it('clamps a nonsense offset to UTC rather than letting registerSafe revert', () => {
    mockOffset(-100_000);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(0);

    mockOffset(NaN);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(0);
  });

  it('accepts the extremes the contract still allows', () => {
    mockOffset(-24 * 60);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(86_400);
    mockOffset(24 * 60);
    expect(getDeviceTimezoneOffsetSeconds()).toBe(-86_400);
  });
});

describe('usd conversion', () => {
  it('scales whole dollars to the module 6-decimal convention', () => {
    expect(usdToOnChain(1)).toBe(ONE_USD);
    expect(usdToOnChain(1_000)).toBe(1_000_000_000n);
    expect(onChainToUsd(1_000_000_000n)).toBe(1_000);
  });

  it('round-trips every offered preset', () => {
    for (const dollars of DAILY_LIMIT_PRESETS_USD) {
      expect(onChainToUsd(usdToOnChain(dollars))).toBe(dollars);
    }
  });
});

describe('preset filtering against live org ceilings', () => {
  // The ceilings actually deployed on Fuse: $25,000 daily / $250,000 monthly.
  const MAX_DAILY = 25_000n * ONE_USD;
  const MAX_MONTHLY = 250_000n * ONE_USD;

  // The monthly ceiling is deployed at exactly 10x the daily one, which is the *only*
  // reason the top rung survives its own derived monthly. Setting it any lower does not
  // cap the month — it deletes the top options from the picker with nothing to explain
  // why, so the whole ladder being offered is the thing worth asserting.
  it('offers the entire ladder under the deployed ceilings', () => {
    expect(offerablePresets(MAX_DAILY, MAX_MONTHLY)).toEqual([...DAILY_LIMIT_PRESETS_USD]);
  });

  it('drops a preset whose derived monthly would breach the monthly ceiling', () => {
    // The daily ceiling alone would allow every rung; a $10,000 monthly leaves only the
    // floor, because $5,000 derives a $50,000 monthly.
    expect(offerablePresets(MAX_DAILY, 10_000n * ONE_USD)).toEqual([1_000]);
  });

  // The ladder starts at $1,000, so a ceiling under it offers nothing at all rather than
  // a smaller option. That makes a sub-$1,000 ceiling unusable as a rollout throttle: it
  // does not tighten activation, it blocks it. Asserted so the trade is deliberate.
  it('offers nothing at all under a ceiling below the ladder floor', () => {
    expect(offerablePresets(500n * ONE_USD, 5_000n * ONE_USD)).toEqual([]);
  });

  it('offers nothing when the ceilings are closed, so the sheet can say so', () => {
    expect(offerablePresets(0n, 0n)).toEqual([]);
  });

  it('keeps every derived monthly within the monthly ceiling', () => {
    for (const dollars of offerablePresets(MAX_DAILY, MAX_MONTHLY)) {
      expect(usdToOnChain(dollars) * MONTHLY_LIMIT_MULTIPLIER).toBeLessThanOrEqual(MAX_MONTHLY);
    }
  });

  // daily <= monthly is a contract invariant (DailyLimitCannotBeGreaterThanMonthlyLimit).
  // Deriving the monthly makes it unreachable, which is why there is no second input.
  it('can never derive a monthly below the daily', () => {
    expect(MONTHLY_LIMIT_MULTIPLIER).toBeGreaterThanOrEqual(1n);
    for (const dollars of DAILY_LIMIT_PRESETS_USD) {
      const daily = usdToOnChain(dollars);
      expect(daily * MONTHLY_LIMIT_MULTIPLIER).toBeGreaterThanOrEqual(daily);
    }
  });
});

describe('the limit activation registers with', () => {
  // It is offered in the sheet too, so a user who wants a different number is picking
  // between comparable options rather than being shown a limit that is not on the list.
  it('is one of the offered presets', () => {
    expect(DAILY_LIMIT_PRESETS_USD).toContain(INITIAL_DAILY_LIMIT_USD);
  });

  // The point of the default: lowering is immediate and entirely the user's call, raising
  // waits out `limitRaiseDelay`. Setting it at the bottom of the range would make the
  // first over-limit tap a day-long lockout, which is the direction that cannot be fixed
  // quickly.
  it('leaves room to come down rather than sitting at the floor', () => {
    expect(INITIAL_DAILY_LIMIT_USD).toBeGreaterThan(Math.min(...DAILY_LIMIT_PRESETS_USD));
  });

  // Registration is clamped down to the org ceilings, never up. If the default itself is
  // unreachable under the deployed ceilings then every activation silently falls back,
  // which is worth failing a test over rather than discovering in the funnel.
  it('is reachable under the deployed ceilings', () => {
    expect(offerablePresets(25_000n * ONE_USD, 250_000n * ONE_USD)).toContain(
      INITIAL_DAILY_LIMIT_USD,
    );
  });
});

/**
 * The cap the activation press signs with. A card that spends from the Safe is only
 * issued once this registration lands, so what this returns decides whether a user gets
 * a card at all — which is why the null case is a tested outcome rather than a fallback.
 */
describe('activationDailyLimit', () => {
  const ceilings = (maxDailyUsd: number, maxMonthlyUsd: number) => ({
    maxDailyLimitUsd: usdToOnChain(maxDailyUsd),
    maxMonthlyLimitUsd: usdToOnChain(maxMonthlyUsd),
  });

  it('registers the default when the org allows it', () => {
    expect(activationDailyLimit(ceilings(25_000, 250_000))).toBe(INITIAL_DAILY_LIMIT_USD);
  });

  // Upwards would be the org's ceiling read as an entitlement. It is a bound.
  it('never clamps upwards, however generous the ceilings', () => {
    expect(activationDailyLimit(ceilings(50_000, 500_000))).toBe(INITIAL_DAILY_LIMIT_USD);
  });

  // The ceiling a Safe registered under before the caps were raised. Worth its own case:
  // it is what every activation silently fell back to while the app shipped ahead of the
  // owner transaction, and it must be the rung below rather than a revert.
  it('clamps to the old ceiling while the raise has not landed yet', () => {
    expect(activationDailyLimit(ceilings(1_000, 10_000))).toBe(1_000);
  });

  // The largest offer underneath, not the nearest: a ceiling of $4,000 means $1,000,
  // because $5,000 would revert with ExceedsOrgDailyCeiling and cost the user the whole
  // activation.
  it('clamps down to the largest preset the ceiling leaves room for', () => {
    expect(activationDailyLimit(ceilings(5_000, 250_000))).toBe(5_000);
    expect(activationDailyLimit(ceilings(4_000, 250_000))).toBe(1_000);
  });

  // The monthly is derived, so a cap can clear the daily ceiling and still revert with
  // ExceedsOrgMonthlyCeiling — both bounds have to hold. Here the daily ceiling alone
  // would allow $25,000 and the monthly cuts it to $5,000.
  it('respects the monthly ceiling as well as the daily one', () => {
    expect(activationDailyLimit(ceilings(25_000, 50_000))).toBe(5_000);
  });

  // Nothing to grant means nothing worth issuing: the caller blocks activation on this
  // rather than handing over a card that declines every payment. With the ladder starting
  // at $1,000 this is now reachable from any ceiling below the floor, not just a
  // pathological one — which is the cost of removing the small rungs.
  it('is null when no preset is offerable at all', () => {
    expect(activationDailyLimit(ceilings(500, 5_000))).toBeNull();
    expect(activationDailyLimit(ceilings(50, 500))).toBeNull();
  });

  // Before the ceilings are read there is nothing to clamp against. The default stands in
  // for the screen's copy only — the press re-reads and clamps against what it gets.
  it('falls back to the plain default before the ceilings are known', () => {
    expect(activationDailyLimit(null)).toBe(INITIAL_DAILY_LIMIT_USD);
    expect(activationDailyLimit(undefined)).toBe(INITIAL_DAILY_LIMIT_USD);
  });
});

describe('monthlyLimitFor', () => {
  const usd = (dollars: number) => usdToOnChain(dollars);

  it('is ten times the daily for a Safe that has not registered yet', () => {
    expect(monthlyLimitFor(usd(100), null)).toBe(usd(1_000));
  });

  // The pair a Safe registered through this app always has: monthly = 10x daily. Both
  // halves move in the same direction, so neither call can reject the other's component.
  it('moves both halves together when the stored pair are ten times apart', () => {
    const current = { dailyLimitUsd: usd(500), monthlyLimitUsd: usd(5_000) };
    expect(monthlyLimitFor(usd(1_000), current)).toBe(usd(10_000));
    expect(monthlyLimitFor(usd(100), current)).toBe(usd(1_000));
  });

  // A Safe whose stored pair are *not* ten times apart is the case the clamp exists for:
  // with $100 daily / $5,000 monthly stored, the derived monthly for $250 is $2,500, which
  // is *below* the stored monthly, and sending that with a raised daily reverts
  // NotAnIncrease.
  it('never lets the monthly cross the stored one against the daily', () => {
    const defaults = { dailyLimitUsd: usd(100), monthlyLimitUsd: usd(5_000) };

    const raised = monthlyLimitFor(usd(250), defaults);
    expect(raised).toBeGreaterThanOrEqual(defaults.monthlyLimitUsd);

    const lowered = monthlyLimitFor(usd(50), defaults);
    expect(lowered).toBeLessThanOrEqual(defaults.monthlyLimitUsd);
  });

  it('leaves the monthly alone when the daily does not move', () => {
    const current = { dailyLimitUsd: usd(100), monthlyLimitUsd: usd(5_000) };
    expect(monthlyLimitFor(usd(100), current)).toBe(usd(5_000));
  });

  // DailyLimitCannotBeGreaterThanMonthlyLimit is checked by every write path, so no
  // clamped result may ever land below its own daily.
  it('always returns at least the daily it was given', () => {
    const currents = [
      null,
      { dailyLimitUsd: usd(100), monthlyLimitUsd: usd(5_000) },
      { dailyLimitUsd: usd(2_500), monthlyLimitUsd: usd(2_500) },
    ];
    for (const current of currents) {
      for (const dollars of DAILY_LIMIT_PRESETS_USD) {
        expect(monthlyLimitFor(usd(dollars), current)).toBeGreaterThanOrEqual(usd(dollars));
      }
    }
  });
});

describe('formatDelayDuration', () => {
  it('reads the deployed one-hour raise delay as an hour', () => {
    expect(formatDelayDuration(60 * 60)).toBe('1 hour');
  });

  it('still reads a 24-hour delay as hours rather than a day', () => {
    expect(formatDelayDuration(24 * 60 * 60)).toBe('24 hours');
  });

  it('switches to days past two of them', () => {
    expect(formatDelayDuration(3 * 24 * 60 * 60)).toBe('3 days');
  });

  it('singularises', () => {
    expect(formatDelayDuration(60 * 60)).toBe('1 hour');
  });

  // A zero or missing delay is org configuration, not an error, and "0 minutes" reads as
  // a bug in the sentence it appears in.
  it('says something sensible when there is no delay at all', () => {
    expect(formatDelayDuration(0)).toBe('shortly');
  });
});

describe('formatUsd', () => {
  it('omits cents for a round dollar amount', () => {
    expect(formatUsd(1_000n * ONE_USD)).toBe('$1,000');
    expect(formatUsd(500n * ONE_USD)).toBe('$500');
  });

  it('shows cents when there are any', () => {
    expect(formatUsd(1_000_500_000n)).toBe('$1,000.50');
  });
});
