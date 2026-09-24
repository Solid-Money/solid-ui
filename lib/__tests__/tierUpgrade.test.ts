import {
  availableRoutes,
  canAffordUpgrade,
  formatFuse,
  formatFuseHeld,
  formatFuseShortfall,
  formatLockDuration,
  formatMembershipDate,
  formatMembershipDay,
  formatUsd,
  formatUsdHeld,
  fuseForShares,
  fuseSharesForAmount,
  membershipDateLabel,
  nextPurchasableTier,
  remainingFuseForTier,
} from '@/lib/tierUpgrade';
import { RewardsTier, TierMembershipState, TierOffer, TierSubscriptionStatus } from '@/lib/types';

const ONE = 10n ** 18n;

const offer = (overrides: Partial<TierOffer> = {}): TierOffer => ({
  tier: RewardsTier.PRIME,
  lockFuse: 50_000,
  lockAvailable: true,
  annualFeeUsd: 199,
  cashAvailable: true,
  held: false,
  ...overrides,
});

const membership = (overrides: Partial<TierMembershipState> = {}): TierMembershipState => ({
  enabled: true,
  pointsUnlockEnabled: false,
  offers: [offer(), offer({ tier: RewardsTier.ULTRA, lockFuse: 400_000, annualFeeUsd: null })],
  lock: {
    enabled: true,
    lockAddress: '0xlock',
    durationDays: 365,
    lockedFuse: 0,
    lockedShares: '0',
    unlockedTier: RewardsTier.CORE,
    lockedSince: null,
    nextUnlockAt: null,
    nextUnlockFuse: 0,
    maturedFuse: 0,
  },
  subscription: null,
  currentTier: RewardsTier.CORE,
  memberSince: null,
  contracts: {
    chainId: 122,
    lockAddress: '0xlock',
    lockZapAddress: '0xzap',
    subscriptionModuleAddress: '0xmodule',
    shareTokenAddress: '0xshare',
    wrappedNativeAddress: '0xwfuse',
    billingTokenAddress: '0xusdc',
  },
  ...overrides,
});

describe('fuseSharesForAmount', () => {
  it('converts at par', () => {
    expect(fuseSharesForAmount(50_000, ONE)).toBe(50_000n * ONE);
  });

  it('needs fewer shares as the rate grows', () => {
    // At 1.25 FUSE per share, 50,000 FUSE is 40,000 shares.
    expect(fuseSharesForAmount(50_000, ONE + ONE / 4n)).toBe(40_000n * ONE);
  });

  /**
   * The case that decides whether an upgrade works at all: the contract floors
   * `shares * rate`, so the exact quotient can value a wei under the threshold
   * and buy nothing.
   */
  it('rounds up so the locked position is never a wei short', () => {
    const rate = ONE + 1n; // A rate that does not divide evenly.
    const shares = fuseSharesForAmount(50_000, rate);

    expect((shares * rate) / ONE).toBeGreaterThanOrEqual(50_000n * ONE);
  });

  it('is zero for an amount or a rate it cannot use', () => {
    expect(fuseSharesForAmount(0, ONE)).toBe(0n);
    expect(fuseSharesForAmount(-5, ONE)).toBe(0n);
    expect(fuseSharesForAmount(Number.NaN, ONE)).toBe(0n);
    expect(fuseSharesForAmount(50_000, 0n)).toBe(0n);
  });

  /**
   * `toFixed` gives up and returns exponential notation at 1e21, which BigInt
   * cannot parse. No tier is priced anywhere near that — this is a guard
   * against a crash, not a case to support.
   */
  it('refuses an amount too large to convert rather than throwing', () => {
    expect(fuseSharesForAmount(1e21, ONE)).toBe(0n);
    expect(fuseSharesForAmount(Number.MAX_VALUE, ONE)).toBe(0n);
  });
});

describe('fuseForShares', () => {
  it('values a position the way the lock contract does', () => {
    expect(fuseForShares(40_000n * ONE, ONE + ONE / 4n)).toBe(50_000);
  });

  it('is zero without shares or a rate', () => {
    expect(fuseForShares(0n, ONE)).toBe(0);
    expect(fuseForShares(ONE, 0n)).toBe(0);
  });
});

describe('remainingFuseForTier', () => {
  it('counts what is already locked', () => {
    expect(remainingFuseForTier(offer({ lockFuse: 400_000 }), 50_000)).toBe(350_000);
  });

  it('is zero once the threshold is met', () => {
    expect(remainingFuseForTier(offer(), 50_000)).toBe(0);
    expect(remainingFuseForTier(offer(), 60_000)).toBe(0);
  });
});

describe('availableRoutes', () => {
  it('offers both when both are configured', () => {
    expect(availableRoutes(offer())).toEqual(['cash', 'lock']);
  });

  /** Ultra is FUSE-only, which the design shows as a single full-width option. */
  it('offers only the lock when a tier is not sold for cash', () => {
    expect(availableRoutes(offer({ cashAvailable: false }))).toEqual(['lock']);
  });

  it('offers nothing for a tier that is not sold at all', () => {
    expect(availableRoutes(offer({ cashAvailable: false, lockAvailable: false }))).toEqual([]);
    expect(availableRoutes(undefined)).toEqual([]);
  });
});

describe('canAffordUpgrade', () => {
  const base = { offer: offer(), lockedFuse: 0, availableFuse: 0, availableUsdc: 0 };

  /**
   * The bug behind "0 FUSE short — add more to Savings".
   *
   * Both sides of this come out of on-chain bigints through a decimal string
   * and a double, so a position worth exactly the threshold can land a few ulps
   * under it. Strict >= then said "Top up" to someone holding precisely enough,
   * and the shortfall — far too small to render — printed as zero.
   */
  it('treats a position a few ulps under the threshold as enough', () => {
    const offerAt = offer({ lockFuse: 50_000 });

    expect(
      canAffordUpgrade({
        ...base,
        offer: offerAt,
        route: 'lock',
        availableFuse: 50_000 - 1e-12,
      }),
    ).toBe(true);
  });

  /**
   * And the other side of it, which matters more: locking short of the
   * threshold succeeds on-chain and grants no tier, because the backend
   * measures the locked position against the threshold. A user waved through
   * here commits their FUSE for a year and gets nothing, so the tolerance has
   * to stay far below anything anyone could actually be short by.
   */
  it('does not wave through a real shortfall, however small', () => {
    const offerAt = offer({ lockFuse: 50_000 });

    for (const availableFuse of [49_999.9, 49_999.99, 49_999.999]) {
      expect(canAffordUpgrade({ ...base, offer: offerAt, route: 'lock', availableFuse })).toBe(
        false,
      );
    }
  });

  it('needs the whole annual fee in USDC', () => {
    expect(canAffordUpgrade({ ...base, route: 'cash', availableUsdc: 198.99 })).toBe(false);
    expect(canAffordUpgrade({ ...base, route: 'cash', availableUsdc: 199 })).toBe(true);
  });

  it('needs only the remaining FUSE, not the whole threshold', () => {
    expect(
      canAffordUpgrade({
        ...base,
        route: 'lock',
        offer: offer({ lockFuse: 400_000 }),
        lockedFuse: 350_000,
        availableFuse: 50_000,
      }),
    ).toBe(true);
  });

  it('cannot be afforded for cash when the tier is not sold for cash', () => {
    expect(
      canAffordUpgrade({
        ...base,
        route: 'cash',
        offer: offer({ annualFeeUsd: null }),
        availableUsdc: 1_000,
      }),
    ).toBe(false);
  });
});

describe('nextPurchasableTier', () => {
  it('offers the cheapest tier the user does not hold', () => {
    expect(nextPurchasableTier(membership())).toBe(RewardsTier.PRIME);
  });

  it('moves on once that tier is held', () => {
    expect(
      nextPurchasableTier(
        membership({
          offers: [
            offer({ held: true }),
            offer({ tier: RewardsTier.ULTRA, lockFuse: 400_000, annualFeeUsd: null }),
          ],
        }),
      ),
    ).toBe(RewardsTier.ULTRA);
  });

  it('offers nothing once every tier is held', () => {
    expect(
      nextPurchasableTier(
        membership({
          offers: [offer({ held: true }), offer({ tier: RewardsTier.ULTRA, held: true })],
        }),
      ),
    ).toBeNull();
  });

  it('skips a tier that is not currently sold', () => {
    expect(
      nextPurchasableTier(
        membership({
          offers: [
            offer({ cashAvailable: false, lockAvailable: false }),
            offer({ tier: RewardsTier.ULTRA }),
          ],
        }),
      ),
    ).toBe(RewardsTier.ULTRA);
  });
});

describe('membershipDateLabel', () => {
  const subscription = (overrides = {}) => ({
    id: 'sub-1',
    tier: RewardsTier.PRIME,
    status: TierSubscriptionStatus.ACTIVE,
    priceUsd: '199.00',
    currentPeriodStart: '2026-09-10T00:00:00.000Z',
    currentPeriodEnd: '2027-09-10T00:00:00.000Z',
    nextChargeAt: '2027-09-10T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    failedAttempts: 0,
    pastDueSince: null,
    graceEndsAt: null,
    subscribedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  });

  it('is nothing at all without a membership', () => {
    expect(membershipDateLabel(membership())).toBeNull();
  });

  it('counts down to the renewal while it is running', () => {
    expect(membershipDateLabel(membership({ subscription: subscription() }))).toEqual({
      label: 'Renews on',
      date: '2027-09-10T00:00:00.000Z',
    });
  });

  /** A cancelled membership has not ended — it has stopped renewing. */
  it('counts down to the end once it will not renew', () => {
    expect(
      membershipDateLabel(
        membership({
          subscription: subscription({
            status: TierSubscriptionStatus.CANCELLED,
            cancelAtPeriodEnd: true,
            nextChargeAt: null,
          }),
        }),
      ),
    ).toEqual({ label: 'Ends on', date: '2027-09-10T00:00:00.000Z' });
  });

  /** The grace deadline is the date that matters, and the only actionable one. */
  it('counts down to the grace deadline while a renewal is failing', () => {
    expect(
      membershipDateLabel(
        membership({
          subscription: subscription({
            status: TierSubscriptionStatus.PAST_DUE,
            pastDueSince: '2027-09-10T00:00:00.000Z',
            graceEndsAt: '2027-09-17T00:00:00.000Z',
          }),
        }),
      ),
    ).toEqual({ label: 'Payment due by', date: '2027-09-17T00:00:00.000Z' });
  });

  it('says nothing about a membership that is over', () => {
    expect(
      membershipDateLabel(
        membership({ subscription: subscription({ status: TierSubscriptionStatus.EXPIRED }) }),
      ),
    ).toBeNull();
  });
});

describe('formatting', () => {
  /**
   * Spelled out rather than localised: recent ICU writes September as "Sept",
   * and Hermes, JSC and V8 do not ship the same ICU — so a localised date would
   * read differently on iOS, Android and web for the same membership.
   */
  it('writes a date the way the pill does, on every runtime', () => {
    expect(formatMembershipDate('2027-09-10T00:00:00.000Z')).toBe('10 Sep, 2027');
    expect(formatMembershipDay('2026-09-14T00:00:00.000Z')).toBe('Sep 14, 2026');
  });

  it('writes nothing for a date it cannot read', () => {
    expect(formatMembershipDate(null)).toBe('');
    expect(formatMembershipDate('not a date')).toBe('');
    expect(formatMembershipDay(undefined)).toBe('');
  });

  it('groups FUSE and drops the decimals', () => {
    expect(formatFuse(50_000)).toBe('50,000');
    expect(formatFuse(400_000.4)).toBe('400,000');
  });

  it('writes USD with cents', () => {
    expect(formatUsd(199)).toBe('$199.00');
    expect(formatUsd(2_400.5)).toBe('$2,400.50');
  });

  it('renders nothing for a tier that is not sold for cash', () => {
    // Null, not 0 — "$0.00" is the one output a user would read as a price.
    expect(formatUsd(null)).toBe('');
    expect(formatUsd(undefined)).toBe('');
  });

  /**
   * The display half of the same bug. The screen compares to the sixth decimal
   * and shows whole FUSE, so rounding a held balance to nearest let it print
   * "15,000" beside a requirement of "15,000" and still offer "Top up" — the
   * screen contradicting its own numbers.
   */
  it('rounds a held balance down, so it never claims enough', () => {
    expect(formatFuseHeld(14_999.6)).toBe('14,999');
    expect(formatFuseHeld(15_000)).toBe('15,000');
    expect(formatFuseHeld(15_000.9)).toBe('15,000');
  });

  it('rounds a shortfall up, so topping it up always clears it', () => {
    expect(formatFuseShortfall(0.4)).toBe('1');
    expect(formatFuseShortfall(1)).toBe('1');
    expect(formatFuseShortfall(1.1)).toBe('2');
  });

  it('never writes a held balance above what is held, or a shortfall below it', () => {
    for (const amount of [0.1, 0.9, 1.5, 14_999.6, 50_000.4]) {
      expect(Number(formatFuseHeld(amount).replace(/,/g, ''))).toBeLessThanOrEqual(amount);
      expect(Number(formatFuseShortfall(amount).replace(/,/g, ''))).toBeGreaterThanOrEqual(amount);
    }
  });

  it('rounds a USDC balance down to the cent', () => {
    expect(formatUsdHeld(198.999)).toBe('$198.99');
    expect(formatUsdHeld(199)).toBe('$199.00');
  });

  it('writes a lock term in months', () => {
    expect(formatLockDuration(365)).toBe('12 months');
    expect(formatLockDuration(180)).toBe('6 months');
    expect(formatLockDuration(730)).toBe('2 years');
    expect(formatLockDuration(0)).toBe('');
  });
});
