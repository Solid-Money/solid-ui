import {
  DAILY_LIMIT_PRESETS_USD,
  formatUsd,
  getDeviceTimezoneOffsetSeconds,
  MONTHLY_LIMIT_MULTIPLIER,
  onChainToUsd,
  ONE_USD,
  usdToOnChain,
} from '@/constants/cardSpendModule';

/**
 * Mirrors the filter in `RegisterSpendAction`, which decides which daily limits are
 * offered. Kept here so the constraint can be tested without rendering the sheet.
 */
const offerablePresets = (maxDaily: bigint, maxMonthly: bigint) =>
  DAILY_LIMIT_PRESETS_USD.filter(dollars => {
    const daily = usdToOnChain(dollars);
    return daily <= maxDaily && daily * MONTHLY_LIMIT_MULTIPLIER <= maxMonthly;
  });

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

describe('formatUsd', () => {
  it('omits cents for a round dollar amount', () => {
    expect(formatUsd(1_000n * ONE_USD)).toBe('$1,000');
    expect(formatUsd(500n * ONE_USD)).toBe('$500');
  });

  it('shows cents when there are any', () => {
    expect(formatUsd(1_000_500_000n)).toBe('$1,000.50');
  });
});
