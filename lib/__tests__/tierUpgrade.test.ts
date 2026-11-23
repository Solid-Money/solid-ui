import {
  availableRoutes,
  canAffordUpgrade,
  canPayCashFor,
  formatAnnualPrice,
  formatFuse,
  formatFuseHeld,
  formatFuseShortfall,
  formatInviteDiscount,
  formatLockDuration,
  formatMembershipDate,
  formatMembershipDay,
  formatPriceUsd,
  formatRenewalTerms,
  formatRenewsAt,
  formatReplacementNotice,
  formatSaleEnds,
  formatUsd,
  formatUsdHeld,
  formatYearlyPrice,
  fuseForShares,
  fuseSharesForAmount,
  isOfferOnSale,
  isTierOnTrial,
  membershipDateLabel,
  nextPurchasableTier,
  offerFirstYearFeeUsd,
  offerInviteDiscount,
  offerMandateUsd,
  offerPaymentMode,
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
  // Nothing resting on the legacy skip-the-line route by default.
  legacyFuseOnly: false,
  offers: [offer(), offer({ tier: RewardsTier.ULTRA, lockFuse: 600_000, annualFeeUsd: 999 })],
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
    revenueTreasuryAddress: '0xtreasury',
  },
  ...overrides,
});

/** Ultra on Black Friday, to a Prime member: $799 now, $999 a year after. */
const ultraUpgrade = (overrides: Partial<TierOffer> = {}): TierOffer =>
  offer({
    tier: RewardsTier.ULTRA,
    lockFuse: 600_000,
    annualFeeUsd: 999,
    firstYearFeeUsd: 799,
    mandateUsd: 999,
    saleEndsAt: '2026-11-30T12:00:00.000Z',
    paymentMode: 'transfer',
    replacesSubscription: { tier: RewardsTier.PRIME, currentPeriodEnd: '2027-03-01T00:00:00.000Z' },
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

  /** Ultra is sold for cash too now, exactly as Prime is. */
  it('offers both routes on Ultra once it is sold for cash', () => {
    expect(availableRoutes(ultraUpgrade(), membership().contracts)).toEqual(['cash', 'lock']);
  });

  /** What a build that has not opted into transfer upgrades is still sent. */
  it('offers only the lock when a tier is not sold for cash', () => {
    expect(availableRoutes(offer({ cashAvailable: false }))).toEqual(['lock']);
  });

  it('offers nothing for a tier that is not sold at all', () => {
    expect(availableRoutes(offer({ cashAvailable: false, lockAvailable: false }))).toEqual([]);
    expect(availableRoutes(undefined)).toEqual([]);
  });

  /**
   * A transfer upgrade pays the treasury directly, so without the treasury or
   * the USDC there is nothing to build it against — and a "Cash" tab that
   * cannot be signed is not offered.
   */
  it('drops cash for a transfer upgrade it has no addresses for', () => {
    const { contracts } = membership();

    expect(availableRoutes(ultraUpgrade(), { ...contracts, revenueTreasuryAddress: null })).toEqual(
      ['lock'],
    );
    expect(availableRoutes(ultraUpgrade(), { ...contracts, billingTokenAddress: null })).toEqual([
      'lock',
    ]);
    // An older backend sends no treasury at all.
    expect(availableRoutes(ultraUpgrade(), { billingTokenAddress: '0xusdc' })).toEqual(['lock']);
    expect(availableRoutes(ultraUpgrade())).toEqual(['lock']);
  });

  /** A module subscription is charged by the backend, which needs no treasury here. */
  it('keeps cash for a module subscription whatever the treasury', () => {
    expect(availableRoutes(offer(), { billingTokenAddress: null })).toEqual(['cash', 'lock']);
    expect(canPayCashFor(offer({ paymentMode: 'module' }), undefined)).toBe(true);
    expect(canPayCashFor(offer({ cashAvailable: false }), membership().contracts)).toBe(false);
  });
});

describe('offer pricing', () => {
  it('charges the first year at the sale price, and signs the mandate at the annual fee', () => {
    const sale = ultraUpgrade();

    expect(offerFirstYearFeeUsd(sale)).toBe(799);
    expect(offerMandateUsd(sale)).toBe(999);
    expect(isOfferOnSale(sale)).toBe(true);
  });

  /**
   * The bug the mandate change exists to prevent: signing the price paid now
   * would sign $799 during a sale, and the $999 renewal would be refused.
   */
  it('never signs the mandate at the sale price', () => {
    expect(offerMandateUsd(ultraUpgrade({ mandateUsd: undefined }))).toBe(999);
    expect(offerMandateUsd(ultraUpgrade({ mandateUsd: null }))).toBe(999);
  });

  it('takes the mandate the backend sends', () => {
    expect(offerMandateUsd(ultraUpgrade({ mandateUsd: 1_049 }))).toBe(1_049);
  });

  /** An older backend sends none of the new fields: today's behaviour, unchanged. */
  it('falls back to the annual fee and the module on an older backend', () => {
    const old = offer();

    expect(offerFirstYearFeeUsd(old)).toBe(199);
    expect(offerMandateUsd(old)).toBe(199);
    expect(offerPaymentMode(old)).toBe('module');
    expect(isOfferOnSale(old)).toBe(false);
  });

  it('is no sale when the first year costs the annual fee', () => {
    expect(isOfferOnSale(ultraUpgrade({ firstYearFeeUsd: 999 }))).toBe(false);
    expect(isOfferOnSale(ultraUpgrade({ firstYearFeeUsd: 999.000001 }))).toBe(false);
  });

  it('prices nothing for a tier that is not sold for cash', () => {
    expect(offerFirstYearFeeUsd(offer({ annualFeeUsd: null, firstYearFeeUsd: 799 }))).toBeNull();
    expect(offerFirstYearFeeUsd(undefined)).toBeNull();
    expect(offerMandateUsd(offer({ annualFeeUsd: null }))).toBeNull();
  });

  it('ignores a first-year price it cannot use', () => {
    expect(offerFirstYearFeeUsd(ultraUpgrade({ firstYearFeeUsd: 0 }))).toBe(999);
    expect(offerFirstYearFeeUsd(ultraUpgrade({ firstYearFeeUsd: Number.NaN }))).toBe(999);
  });

  it('reads the payment mode, and only ever the two it knows', () => {
    expect(offerPaymentMode(ultraUpgrade())).toBe('transfer');
    expect(offerPaymentMode(offer({ paymentMode: 'module' }))).toBe('module');
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

  /** During a sale the first year is what is charged, so it is what has to be held. */
  it('needs the first year, not the annual fee, during a sale', () => {
    const sale = ultraUpgrade();

    expect(canAffordUpgrade({ ...base, offer: sale, route: 'cash', availableUsdc: 798.99 })).toBe(
      false,
    );
    expect(canAffordUpgrade({ ...base, offer: sale, route: 'cash', availableUsdc: 799 })).toBe(
      true,
    );
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
            offer({ tier: RewardsTier.ULTRA, lockFuse: 600_000, annualFeeUsd: 999 }),
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

describe('isTierOnTrial', () => {
  /** `currentTier` folds the trial in; `held` does not. */
  it('is true for a tier the trial reaches and the user does not own', () => {
    const onUltraTrial = membership({ currentTier: RewardsTier.ULTRA });

    expect(isTierOnTrial(onUltraTrial, RewardsTier.ULTRA)).toBe(true);
    expect(isTierOnTrial(onUltraTrial, RewardsTier.PRIME)).toBe(true);
  });

  it('is false for a tier the user owns', () => {
    const ownsPrime = membership({
      currentTier: RewardsTier.ULTRA,
      offers: [
        offer({ held: true }),
        offer({ tier: RewardsTier.ULTRA, lockFuse: 600_000, annualFeeUsd: 999 }),
      ],
    });

    expect(isTierOnTrial(ownsPrime, RewardsTier.PRIME)).toBe(false);
    expect(isTierOnTrial(ownsPrime, RewardsTier.ULTRA)).toBe(true);
  });

  it('is false for a tier above the current one — that is an upgrade', () => {
    expect(isTierOnTrial(membership({ currentTier: RewardsTier.PRIME }), RewardsTier.ULTRA)).toBe(
      false,
    );
    expect(isTierOnTrial(membership(), RewardsTier.PRIME)).toBe(false);
  });

  it('is false with nothing to read', () => {
    expect(isTierOnTrial(undefined, RewardsTier.PRIME)).toBe(false);
    expect(isTierOnTrial(membership({ offers: [] }), RewardsTier.CORE)).toBe(false);
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

  /** Ended by an upgrade: nothing renews and nothing is due. */
  it('says nothing about a membership an upgrade replaced', () => {
    expect(
      membershipDateLabel(
        membership({ subscription: subscription({ status: TierSubscriptionStatus.REPLACED }) }),
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

  it('writes a price compactly for running copy', () => {
    expect(formatPriceUsd(999)).toBe('$999');
    expect(formatPriceUsd(1_049)).toBe('$1,049');
    expect(formatPriceUsd(149.5)).toBe('$149.5');
  });

  describe('a sale', () => {
    it('reads as the sale price with the annual fee it replaces, in plain text', () => {
      expect(formatAnnualPrice(ultraUpgrade())).toBe('$799/year (was $999)');
      expect(formatYearlyPrice(159, 199)).toBe('$159/year (was $199)');
    });

    it('reads as just the price outside a sale', () => {
      expect(formatAnnualPrice(offer())).toBe('$199/year');
      expect(formatYearlyPrice(999, 999)).toBe('$999/year');
      expect(formatYearlyPrice(999)).toBe('$999/year');
    });

    it('reads as nothing for a tier that is not sold for cash', () => {
      expect(formatAnnualPrice(offer({ annualFeeUsd: null }))).toBe('');
      expect(formatAnnualPrice(undefined)).toBe('');
    });

    /** The discount is the first year's only, and the review must say what renews. */
    it('states the renewal beside the sale price', () => {
      expect(formatRenewalTerms(ultraUpgrade())).toBe('First year $799, then $999/year');
      expect(formatRenewalTerms(offer())).toBe('Renews at $199/year');
      expect(formatRenewsAt(ultraUpgrade())).toBe('Renews at $999/year');
      expect(formatRenewalTerms(offer({ annualFeeUsd: null }))).toBe('');
    });

    it('says when the offer ends, only while it runs', () => {
      expect(formatSaleEnds(ultraUpgrade())).toBe('Offer ends Nov 30, 2026');
      expect(formatSaleEnds(ultraUpgrade({ firstYearFeeUsd: 999 }))).toBe('');
      expect(formatSaleEnds(ultraUpgrade({ saleEndsAt: null }))).toBe('');
    });
  });

  describe('an upgrade that replaces a membership', () => {
    it('says the old one ends now and is not refunded', () => {
      expect(formatReplacementNotice(ultraUpgrade())).toBe(
        'Your Prime membership ends today and Ultra starts now for 12 months. The time left on Prime isn’t refunded.',
      );
    });

    it('says nothing when there is nothing to replace', () => {
      expect(formatReplacementNotice(ultraUpgrade({ replacesSubscription: null }))).toBe('');
      expect(formatReplacementNotice(offer())).toBe('');
    });
  });

  it('writes a lock term in months', () => {
    expect(formatLockDuration(365)).toBe('12 months');
    expect(formatLockDuration(180)).toBe('6 months');
    expect(formatLockDuration(730)).toBe('2 years');
    expect(formatLockDuration(0)).toBe('');
  });
});

describe('offerInviteDiscount', () => {
  it('reads the KOL invite discount that prices the first year', () => {
    const discounted = offer({
      firstYearFeeUsd: 99.5,
      inviteDiscount: { pct: 50, inviterUsername: 'artem.betev' },
    });
    expect(offerInviteDiscount(discounted)).toEqual({ pct: 50, inviterUsername: 'artem.betev' });
    expect(formatInviteDiscount(discounted)).toBe(
      "50% off your first year with artem.betev's invite",
    );
    // No sale-style end: the invite line is what explains the price.
    expect(formatSaleEnds(discounted)).toBe('');
  });

  it('ignores a discount that does not lower the price, or is malformed', () => {
    expect(
      offerInviteDiscount(offer({ inviteDiscount: { pct: 50, inviterUsername: 'x' } })),
    ).toBeNull();
    expect(
      offerInviteDiscount(
        offer({
          firstYearFeeUsd: 99.5,
          inviteDiscount: { pct: Number.NaN, inviterUsername: 'x' },
        }),
      ),
    ).toBeNull();
    expect(offerInviteDiscount(offer({ firstYearFeeUsd: 99.5, inviteDiscount: null }))).toBeNull();
    expect(formatInviteDiscount(undefined)).toBe('');
  });
});
