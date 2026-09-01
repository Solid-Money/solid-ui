import {
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
  // The ceilings actually deployed on Fuse: $1,000 daily / $10,000 monthly.
  const MAX_DAILY = 1_000n * ONE_USD;
  const MAX_MONTHLY = 10_000n * ONE_USD;

  it('offers only limits the module would accept', () => {
    // $2,500 is dropped by the daily ceiling. Offering it would surface as
    // ExceedsOrgDailyCeiling, which a user cannot act on.
    expect(offerablePresets(MAX_DAILY, MAX_MONTHLY)).toEqual([100, 250, 500, 1_000]);
  });

  it('drops a preset whose derived monthly would breach the monthly ceiling', () => {
    // Daily alone would allow $500; 10x monthly would not.
    expect(offerablePresets(MAX_DAILY, 2_500n * ONE_USD)).toEqual([100, 250]);
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
  // The activation button never asks, so the grant it makes without asking has to be the
  // smallest one on offer. A regression here silently widens what every new card may
  // take from a Safe on a single unexplained signature.
  it('is the smallest preset', () => {
    expect(INITIAL_DAILY_LIMIT_USD).toBe(Math.min(...DAILY_LIMIT_PRESETS_USD));
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

  // A Safe that took the org defaults ($100 daily / $5,000 monthly) is the case the
  // clamp exists for: the derived monthly for $250 is $2,500, which is *below* the
  // stored monthly, and sending that with a raised daily reverts NotAnIncrease.
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
  it('reads the deployed 24-hour raise delay as hours', () => {
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
