import {
  activeTierBalance,
  fixedPointUsd,
  formatBalanceUsd,
  formatShortfallUsd,
  formatThresholdUsd,
  formatTierBalanceDate,
  outflowWarning,
  outflowWarningCopy,
  parseTokenUnits,
  relevantTrack,
  trackNeedsTopUp,
  trackNudgeCopy,
  trackProgress,
  trackStatusLine,
  unlockedByBalance,
} from '@/lib/tierBalance';
import {
  RewardsTier,
  type TierBalanceRouteDto,
  type TierBalanceTrackDto,
  type TierMembershipState,
} from '@/lib/types';

const { CORE, PRIME, ULTRA } = RewardsTier;
const NOW = new Date('2026-11-24T12:00:00Z');

// Deliberately not the launch config: every figure in the copy has to come from here.
const PRIME_USD = 7_300;
const ULTRA_USD = 41_000;

const trackFor = (
  tier: RewardsTier.PRIME | RewardsTier.ULTRA,
  overrides: Partial<TierBalanceTrackDto> = {},
): TierBalanceTrackDto => ({
  tier,
  status: 'none',
  thresholdUsd: tier === PRIME ? PRIME_USD : ULTRA_USD,
  shortfallUsd: 0,
  progressPct: 0,
  daysHeld: 0,
  qualifiesOn: null,
  unlockedAt: null,
  graceEndsAt: null,
  reentryAt: null,
  ...overrides,
});

const route = (
  overrides: Partial<TierBalanceRouteDto> = {},
  prime: Partial<TierBalanceTrackDto> = {},
  ultra: Partial<TierBalanceTrackDto> = {},
): TierBalanceRouteDto => ({
  enabled: true,
  grantsTier: CORE,
  holdsCurrentTier: false,
  currentUsd: 5_000,
  measuredAt: '2026-11-24T10:00:00Z',
  lowestUsd: 4_800,
  lookbackDays: 21,
  graceDays: 4,
  reentryDays: 45,
  breakdown: null,
  rules: { countsCreditCollateral: true, subtractsCreditDebt: false, countsLockedFuse: true },
  prime: trackFor(PRIME, prime),
  ultra: trackFor(ULTRA, ultra),
  ...overrides,
});

describe('activeTierBalance', () => {
  it('shows nothing for a payload without the route, a null one, or one not enabled', () => {
    expect(activeTierBalance(undefined)).toBeNull();
    expect(activeTierBalance(null)).toBeNull();
    // An older backend sends no field at all.
    expect(activeTierBalance({} as Pick<TierMembershipState, 'balance'>)).toBeNull();
    expect(activeTierBalance({ balance: null })).toBeNull();
    expect(activeTierBalance({ balance: route({ enabled: false }) })).toBeNull();
  });

  it('hands back the route for a user it is staged to', () => {
    const balance = route();
    expect(activeTierBalance({ balance })).toBe(balance);
  });
});

describe('relevantTrack', () => {
  it('talks about a tier the route holds first, Ultra before Prime', () => {
    const balance = route({}, { status: 'active' }, { status: 'grace' });
    expect(relevantTrack(balance, ULTRA)?.tier).toBe(ULTRA);
    expect(relevantTrack(route({}, { status: 'grace' }), PRIME)?.tier).toBe(PRIME);
  });

  it('otherwise takes the lowest tier above the current one that is building', () => {
    expect(relevantTrack(route({}, { status: 'building' }), CORE)?.tier).toBe(PRIME);
    expect(relevantTrack(route({}, { status: 'none' }, { status: 'building' }), CORE)?.tier).toBe(
      ULTRA,
    );
    // A Prime member by subscription: only Ultra is above them.
    expect(
      relevantTrack(route({}, { status: 'building' }, { status: 'building' }), PRIME)?.tier,
    ).toBe(ULTRA);
  });

  it('falls back to the next tier up when nothing is building', () => {
    expect(relevantTrack(route(), CORE)?.tier).toBe(PRIME);
    expect(relevantTrack(route(), undefined)?.tier).toBe(PRIME);
    expect(relevantTrack(route({}, {}, { status: 'cooldown' }), PRIME)?.tier).toBe(ULTRA);
  });

  it('has nothing to say to an Ultra member by another route, or without the route', () => {
    expect(relevantTrack(route({}, { status: 'building' }), ULTRA)).toBeNull();
    expect(relevantTrack(null, CORE)).toBeNull();
    expect(relevantTrack(route({ enabled: false }), CORE)).toBeNull();
  });
});

describe('outflowWarning', () => {
  it('warns that building progress restarts when the balance would drop under the threshold', () => {
    const balance = route(
      { currentUsd: 8_000 },
      { status: 'building', daysHeld: 9, qualifiesOn: '2026-12-06' },
    );
    expect(outflowWarning(balance, CORE, 701)).toEqual({
      kind: 'reset',
      tier: PRIME,
      thresholdUsd: PRIME_USD,
      graceDays: 4,
      graceEndsAt: null,
      lookbackDays: 21,
      daysHeld: 9,
      reentryDays: 45,
    });
    // Still at the threshold afterwards: nothing to say.
    expect(outflowWarning(balance, CORE, 700)).toBeNull();
  });

  it('warns of the grace period when the route holds the tier and the drop starts it', () => {
    const balance = route(
      { currentUsd: 8_000, holdsCurrentTier: true, grantsTier: PRIME },
      { status: 'active', unlockedAt: '2026-10-01T00:00:00Z' },
    );
    expect(outflowWarning(balance, PRIME, 1_000)).toMatchObject({ kind: 'grace', graceDays: 4 });
    // No grace configured: the drop ends the tier.
    expect(outflowWarning({ ...balance, graceDays: 0 }, PRIME, 1_000)?.kind).toBe('lose');
  });

  it('warns of losing the tier when its grace is already running', () => {
    const balance = route(
      { currentUsd: 7_000, holdsCurrentTier: true, grantsTier: PRIME },
      { status: 'grace', graceEndsAt: '2026-11-28T00:00:00Z' },
    );
    expect(outflowWarning(balance, PRIME, 50)).toMatchObject({
      kind: 'lose',
      tier: PRIME,
      graceEndsAt: '2026-11-28T00:00:00Z',
    });
  });

  it('says nothing when another route holds the tier anyway', () => {
    const balance = route(
      { currentUsd: 8_000, holdsCurrentTier: false, grantsTier: PRIME },
      { status: 'active' },
    );
    expect(outflowWarning(balance, PRIME, 5_000)).toBeNull();
  });

  it('follows the Ultra track for an Ultra member the route holds', () => {
    const balance = route(
      { currentUsd: 42_000, holdsCurrentTier: true, grantsTier: ULTRA },
      { status: 'active' },
      { status: 'active' },
    );
    expect(outflowWarning(balance, ULTRA, 2_000)).toMatchObject({
      kind: 'grace',
      tier: ULTRA,
      thresholdUsd: ULTRA_USD,
    });
    expect(outflowWarning(balance, ULTRA, 1_000)).toBeNull();
  });

  it('warns that Ultra progress resets while the Prime the route holds stays funded', () => {
    const balance = route(
      { currentUsd: 42_000, holdsCurrentTier: true, grantsTier: PRIME },
      { status: 'active' },
      { status: 'building', daysHeld: 12 },
    );
    expect(outflowWarning(balance, PRIME, 2_000)).toMatchObject({
      kind: 'reset',
      tier: ULTRA,
      thresholdUsd: ULTRA_USD,
      daysHeld: 12,
    });
    // Down past Prime too: losing the tier held comes first.
    expect(outflowWarning(balance, PRIME, 40_000)).toMatchObject({ kind: 'grace', tier: PRIME });
  });

  it('warns about Ultra progress even when another route holds Prime', () => {
    const balance = route(
      { currentUsd: 42_000, holdsCurrentTier: false, grantsTier: PRIME },
      { status: 'active' },
      { status: 'building' },
    );
    expect(outflowWarning(balance, PRIME, 2_000)).toMatchObject({ kind: 'reset', tier: ULTRA });
    // Prime stays held by the other route: dropping under it is not this route's to warn about.
    expect(outflowWarning(balance, PRIME, 40_000)).toMatchObject({ kind: 'reset', tier: ULTRA });
  });

  it('says nothing about building progress for a tier already held another way', () => {
    const balance = route({ currentUsd: 42_000 }, { status: 'building' }, { status: 'building' });
    expect(outflowWarning(balance, ULTRA, 40_000)).toBeNull();
  });

  it('says nothing for a track with nothing to lose', () => {
    expect(outflowWarning(route({ currentUsd: 100 }), CORE, 50)).toBeNull();
    expect(outflowWarning(route({ currentUsd: 100 }, { status: 'cooldown' }), CORE, 50)).toBeNull();
  });

  it('says nothing for an outflow it cannot price, or before a balance is measured', () => {
    const balance = route({ currentUsd: 8_000 }, { status: 'building' });
    expect(outflowWarning(balance, CORE, 0)).toBeNull();
    expect(outflowWarning(balance, CORE, -5)).toBeNull();
    expect(outflowWarning(balance, CORE, Number.NaN)).toBeNull();
    expect(outflowWarning({ ...balance, currentUsd: null }, CORE, 8_000)).toBeNull();
  });

  it('says nothing without the route', () => {
    expect(outflowWarning(null, CORE, 1_000_000)).toBeNull();
    expect(outflowWarning(route({ enabled: false }, { status: 'building' }), CORE, 9e9)).toBeNull();
  });
});

describe('fixed-point valuation', () => {
  it('parses a typed amount to base units, or null for anything else', () => {
    expect(parseTokenUnits('1.5', 6)).toBe(1_500_000n);
    expect(parseTokenUnits(' 0.00000001 ', 8)).toBe(1n);
    expect(parseTokenUnits('', 6)).toBeNull();
    expect(parseTokenUnits('abc', 6)).toBeNull();
    expect(parseTokenUnits('0', 6)).toBeNull();
    expect(parseTokenUnits('1', undefined)).toBeNull();
  });

  it('values base units in fixed point, through a rate and a price', () => {
    // 7,300 soUSD at 1.090824 USDC per share.
    expect(fixedPointUsd(7_300_000_000n, 6, 1.090824)).toBe(7963.0152);
    // 0.1 soBTC worth of sats at $61,413.59.
    expect(fixedPointUsd(10_000_000n, 8, 61_413.59)).toBe(6141.359);
    // soEURC: shares → euros at the rate → dollars at the EURC price, with the
    // sub-micro-dollar remainder rounded up.
    expect(fixedPointUsd(1_000_000_000n, 6, 1.004846, 1.0898756)).toBe(1095.157138);
  });

  it('keeps fractions of a cent, so a sliver past the allowance still warns', () => {
    // $700.000001 out of $8,000 leaves $7,299.999999: below a $7,300 threshold.
    const sliver = fixedPointUsd(700_000_001n, 6, 1);
    expect(sliver).toBe(700.000001);
    expect(8_000 - sliver < 7_300).toBe(true);
    // Exactly $700 leaves exactly $7,300: not below.
    const exact = fixedPointUsd(700_000_000n, 6, 1);
    expect(exact).toBe(700);
    expect(8_000 - exact < 7_300).toBe(false);
  });

  it('is 0 without units or a usable price', () => {
    expect(fixedPointUsd(null, 6, 1)).toBe(0);
    expect(fixedPointUsd(1_000_000n, 6, 0)).toBe(0);
    expect(fixedPointUsd(1_000_000n, 6, Number.NaN)).toBe(0);
    expect(fixedPointUsd(1_000_000n, 6)).toBe(0);
  });
});

describe('formatting', () => {
  it('never shows an insufficient balance as reaching the target', () => {
    expect(formatBalanceUsd(7_299.99)).toBe('$7,299');
    expect(formatThresholdUsd(PRIME_USD)).toBe('$7.3K');
    expect(formatBalanceUsd(-1)).toBe('$0');
  });

  it('writes thresholds compactly and shortfalls rounded up', () => {
    expect(formatThresholdUsd(7_500)).toBe('$7.5K');
    expect(formatThresholdUsd(35_000)).toBe('$35K');
    expect(formatThresholdUsd(250)).toBe('$250');
    expect(formatShortfallUsd(1_234.01)).toBe('$1,235');
    expect(formatShortfallUsd(-3)).toBe('$0');
  });

  it('writes the qualifying day as that UTC day, wherever the reader is', () => {
    expect(formatTierBalanceDate('2026-12-24', NOW)).toBe('Dec 24');
    expect(formatTierBalanceDate('2027-01-02', NOW)).toBe('Jan 2, 2027');
  });

  it('writes instants in the reader’s day, and nothing for a missing date', () => {
    expect(formatTierBalanceDate('2026-12-03T12:00:00Z', NOW)).toBe('Dec 3');
    expect(formatTierBalanceDate(null, NOW)).toBe('');
    expect(formatTierBalanceDate('not a date', NOW)).toBe('');
  });
});

describe('trackStatusLine', () => {
  it('says what is missing for a track with nothing yet', () => {
    const balance = route({ currentUsd: 5_000 }, { shortfallUsd: 2_300.4 });
    expect(trackStatusLine(balance.prime, balance, NOW)).toBe(
      'Add $2,301 to Earn and keep it there 21 days to unlock Prime',
    );
    // Before the first measurement there is no shortfall to quote.
    const unmeasured = route({ currentUsd: null }, { shortfallUsd: 7_300 });
    expect(trackStatusLine(unmeasured.prime, unmeasured, NOW)).toBe(
      'Hold $7.3K in Earn for 21 days to unlock Prime',
    );
  });

  it('says until when a building track has to hold', () => {
    const balance = route({}, { status: 'building', qualifiesOn: '2026-12-06', daysHeld: 9 });
    expect(trackStatusLine(balance.prime, balance, NOW)).toBe(
      'Keep it there until Dec 6 to unlock Prime',
    );
    const undated = route({}, { status: 'building', daysHeld: 9 });
    expect(trackStatusLine(undated.prime, undated, NOW)).toBe(
      'Keep it there 12 days more to unlock Prime',
    );
  });

  it('says how an active, grace or cooldown track stands', () => {
    const active = route({}, {}, { status: 'active' });
    expect(trackStatusLine(active.ultra, active, NOW)).toBe('Unlocked by holding $41K in Earn');

    const grace = route({}, { status: 'grace', graceEndsAt: '2026-11-28T12:00:00Z' });
    expect(trackStatusLine(grace.prime, grace, NOW)).toBe(
      'Top up to $7.3K by Nov 28 to keep Prime',
    );

    const cooldown = route({}, { status: 'cooldown', reentryAt: '2027-01-08T12:00:00Z' });
    expect(trackStatusLine(cooldown.prime, cooldown, NOW)).toBe('Available again on Jan 8, 2027');
  });
});

describe('trackNudgeCopy', () => {
  it('leads with what more unlocks the tier', () => {
    const balance = route({ currentUsd: 5_000 }, { shortfallUsd: 2_300 });
    expect(trackNudgeCopy(balance.prime, balance, NOW)).toEqual({
      title: '$2,300 more unlocks Prime',
      body: 'Hold $7.3K in Earn for 21 days to unlock Prime',
    });
  });

  it('asks for a top-up by the end of the grace period', () => {
    const balance = route({}, { status: 'grace', graceEndsAt: '2026-11-28T12:00:00Z' });
    expect(trackNudgeCopy(balance.prime, balance, NOW)).toEqual({
      title: 'Top up to keep Prime',
      body: 'Your Earn balance is under $7.3K. Top it up by Nov 28.',
    });
  });
});

describe('trackProgress', () => {
  it('counts days for a building track and dollars otherwise', () => {
    const building = route({}, { status: 'building', daysHeld: 7 });
    expect(trackProgress(building.prime, building)).toEqual({
      percent: (7 / 21) * 100,
      value: '7',
      target: '/21 days',
    });

    const none = route({ currentUsd: 3_650.9 }, { progressPct: 50 });
    expect(trackProgress(none.prime, none)).toEqual({
      percent: 50,
      value: '$3,650',
      target: '/$7.3K',
    });

    const unmeasured = route({ currentUsd: null }, { progressPct: 140 });
    expect(trackProgress(unmeasured.prime, unmeasured)).toEqual({
      percent: 100,
      value: null,
      target: '/$7.3K',
    });
  });
});

describe('trackNeedsTopUp', () => {
  it('asks for money only when that is the next step', () => {
    expect(trackNeedsTopUp(trackFor(PRIME, { status: 'none' }))).toBe(true);
    expect(trackNeedsTopUp(trackFor(PRIME, { status: 'grace' }))).toBe(true);
    expect(trackNeedsTopUp(trackFor(PRIME, { status: 'building' }))).toBe(false);
    expect(trackNeedsTopUp(trackFor(PRIME, { status: 'active' }))).toBe(false);
    expect(trackNeedsTopUp(trackFor(PRIME, { status: 'cooldown' }))).toBe(false);
  });
});

describe('outflowWarningCopy', () => {
  const base = {
    tier: PRIME,
    thresholdUsd: PRIME_USD,
    graceDays: 4,
    graceEndsAt: null,
    lookbackDays: 21,
    daysHeld: 9,
    reentryDays: 45,
  } as const;

  it('quotes the progress that would restart', () => {
    expect(outflowWarningCopy({ ...base, kind: 'reset' }, NOW)).toEqual({
      title: 'This restarts your progress to Prime',
      body: 'Your Earn balance would drop below $7.3K, and your 9 days toward Prime would start over. It takes 21 days at $7.3K or more to unlock it.',
    });
  });

  it('quotes the grace period and the re-entry wait from the payload', () => {
    expect(outflowWarningCopy({ ...base, kind: 'grace' }, NOW).body).toBe(
      "Your Earn balance would drop below $7.3K. You'd have up to 4 days to bring it back up before Prime ends. Holding can't unlock it again for 45 days after that.",
    );
  });

  it('dates the end of a running grace period', () => {
    expect(
      outflowWarningCopy({ ...base, kind: 'lose', graceEndsAt: '2026-11-28T12:00:00Z' }, NOW),
    ).toEqual({
      title: 'You could lose Prime',
      body: "Your Earn balance would stay below $7.3K. Prime ends on Nov 28 unless it's back above $7.3K by then. Holding can't unlock it again for 45 days after that.",
    });
    expect(outflowWarningCopy({ ...base, kind: 'lose', reentryDays: 0 }, NOW).body).toBe(
      'Your Earn balance would drop below $7.3K, which ends Prime.',
    );
  });
});

describe('unlockedByBalance', () => {
  it('credits the route only with a tier it alone holds', () => {
    const held = route({ holdsCurrentTier: true, grantsTier: PRIME }, { status: 'active' });
    expect(unlockedByBalance(held, PRIME)).toBe(true);
    expect(unlockedByBalance(held, ULTRA)).toBe(false);
    expect(unlockedByBalance({ ...held, holdsCurrentTier: false }, PRIME)).toBe(false);
    expect(unlockedByBalance({ ...held, enabled: false }, PRIME)).toBe(false);
    expect(unlockedByBalance(null, PRIME)).toBe(false);
  });
});
