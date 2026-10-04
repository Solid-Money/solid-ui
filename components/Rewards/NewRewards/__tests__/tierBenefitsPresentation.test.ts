import {
  TIER_PRESENTATION,
  tierOfferRows,
  tierOfferSubtitle,
  tierPresentationContent,
  tierPresentationFees,
} from '@/components/Rewards/NewRewards/tierBenefitsPresentation';
import { RewardsTier, type TierBenefits, type TierFees, type TierOffer } from '@/lib/types';

const { CORE, PRIME, ULTRA } = RewardsTier;
const benefits = (tier: RewardsTier, overrides: Partial<TierBenefits> = {}) =>
  ({ tier, ...overrides }) as TierBenefits;
const offer = (overrides: Partial<TierOffer> = {}): TierOffer => ({
  tier: PRIME,
  annualFeeUsd: 149.5,
  cashAvailable: true,
  lockFuse: 37_500,
  lockAvailable: true,
  held: false,
  ...overrides,
});

describe('tierPresentationContent', () => {
  it('quotes actual subscription and yield benefits consistently across stats and perks', () => {
    const content = tierPresentationContent(
      PRIME,
      benefits(PRIME, {
        subscriptionDiscountRate: 25,
        yieldBoostPercentage: 2.5,
        yieldBoostBalanceCap: 12_500,
      }),
    );
    expect(content.subscriptionRate).toBe('25%');
    expect(content.stats).toContainEqual({ value: '25%', label: 'Subscriptions' });
    expect(content.stats).toContainEqual({ value: '+2.5%', label: 'Yield boost' });
    expect(content.perks[0].description).toBe('+2.5% APY on up to $12,500 in savings');
    expect(content.perks[1].description).toBe('25% on subscriptions, 8% on rides');
  });

  it('preserves meaningful zeros instead of promising fallback rewards', () => {
    const content = tierPresentationContent(
      ULTRA,
      benefits(ULTRA, {
        subscriptionDiscountRate: 0,
        yieldBoostPercentage: 0,
        yieldBoostBalanceCap: 0,
      }),
    );
    expect(content.subscriptionRate).toBe('0%');
    expect(content.stats).toContainEqual({ value: '0%', label: 'Subscriptions' });
    expect(content.stats).toContainEqual({ value: '0%', label: 'Yield boost' });
    expect(content.perks[0].description).toBe('0% APY on up to $0 in savings');
    expect(content.perks[1].description).toBe('0% on subscriptions, 10% on rides');
  });

  // Deep equality on the design fields only: the content also carries the
  // resolved category list, which is derived from the API rather than designed
  // and is asserted on its own below.
  it.each([CORE, PRIME, ULTRA])('keeps the design when %s numerical fields are absent', tier => {
    for (const content of [
      tierPresentationContent(tier),
      tierPresentationContent(tier, benefits(tier)),
    ]) {
      expect(content).toMatchObject(TIER_PRESENTATION[tier]);
      expect(Object.keys(content).sort()).toEqual(
        [...Object.keys(TIER_PRESENTATION[tier]), 'subscriptionCategories'].sort(),
      );
    }
  });

  // The comparison page used to read its ride and airline rates straight off
  // the design table, so an admin could re-price or pause a category and that
  // page would go on advertising the old one.
  describe('per-category rates', () => {
    const rates = (entries: Record<string, number>) =>
      Object.entries(entries).map(([key, rate]) => ({ key, label: key, rate }));

    it('quotes the rates the API reports, not the design', () => {
      const content = tierPresentationContent(
        ULTRA,
        benefits(ULTRA, {
          subscriptionDiscountRate: 20,
          subscriptionCategoryRates: rates({
            ai: 20,
            streaming: 20,
            music: 20,
            rides: 12,
            airlines: 15,
          }),
        }),
      );

      expect(content.rideRate).toBe('12%');
      expect(content.airlineRate).toBe('15%');
      expect(content.subscriptionCategories.find(category => category.key === 'rides')?.rate).toBe(
        12,
      );
      expect(content.perks[1].description).toBe('20% on subscriptions, 12% on rides');
      expect(content.perks[2].description).toBe('15% back on 12 global airlines');
    });

    it('drops a paused category from the rows it draws', () => {
      const content = tierPresentationContent(
        ULTRA,
        benefits(ULTRA, {
          subscriptionDiscountRate: 20,
          subscriptionCategoryRates: rates({ ai: 20, streaming: 20, music: 20 }),
        }),
      );

      expect(content.subscriptionCategories.map(category => category.key)).toEqual([
        'ai',
        'streaming',
        'music',
      ]);
      expect(content.rideRate).toBeNull();
      expect(content.airlineRate).toBeNull();
    });

    it('stops the perk copy selling rides once they are paused', () => {
      const content = tierPresentationContent(
        PRIME,
        benefits(PRIME, {
          subscriptionDiscountRate: 10,
          subscriptionCategoryRates: rates({ ai: 10, streaming: 10, music: 10 }),
        }),
      );

      expect(content.perks[1].title).toBe('Subscription rewards');
      expect(content.perks[1].description).toBe('10% on subscriptions');
    });

    // Dropping the perk rather than printing "0%" is only safe because each
    // perk names its own icon; taking the glyph from the row would slide the
    // cashback-cap icon onto whatever followed.
    it('drops the airline perk entirely when airlines pay nothing', () => {
      const content = tierPresentationContent(
        ULTRA,
        benefits(ULTRA, {
          subscriptionDiscountRate: 20,
          subscriptionCategoryRates: rates({ ai: 20, rides: 10, airlines: 0 }),
        }),
      );

      expect(content.perks.map(perk => perk.icon)).toEqual(['yield', 'subscription']);
    });

    // A rate of 0 the API did send is the locked state that sells the upgrade,
    // so the row stays — unlike a paused category, which is simply absent.
    it('keeps a locked category as a row at 0', () => {
      const content = tierPresentationContent(
        PRIME,
        benefits(PRIME, {
          subscriptionDiscountRate: 10,
          subscriptionCategoryRates: rates({ ai: 10, rides: 8, airlines: 0 }),
        }),
      );

      expect(content.subscriptionCategories.map(category => category.key)).toContain('airlines');
      expect(
        content.subscriptionCategories.find(category => category.key === 'airlines')?.rate,
      ).toBe(0);
      expect(content.airlineRate).toBeNull();
    });
  });

  it('uses a partial live response without replacing other design fallback values', () => {
    const content = tierPresentationContent(
      ULTRA,
      benefits(ULTRA, { subscriptionDiscountRate: 50 }),
    );
    expect(content.subscriptionRate).toBe('50%');
    expect(content.stats).toContainEqual({ value: '+3%', label: 'Yield boost' });
    expect(content.perks[0].description).toBe('+3% APY on up to $25K in savings');
    expect(content.airlineRate).toBe('10%');
    expect(TIER_PRESENTATION[ULTRA].subscriptionRate).toBe('20%');
  });
});

describe('tierPresentationFees', () => {
  it('preserves every authoritative fee row, including stocks, and actual cashback caps', () => {
    const live = {
      lines: [
        { key: 'fx', label: 'FX conversion', rate: 0.0015, value: '0.15%' },
        { key: 'stocks', label: 'Stocks', rate: 0.002, value: '0.2%' },
      ],
      cashbackCap: 'Up to $175 monthly',
    } as TierFees;
    expect(tierPresentationFees(PRIME, live)).toEqual({
      lines: live.lines,
      cashbackCap: 'Up to $175 monthly',
    });
  });

  it('uses the design fallback only when the actual fee table is absent or empty', () => {
    const fallback = tierPresentationFees(PRIME);
    expect(tierPresentationFees(PRIME, { lines: [] } as unknown as TierFees)).toEqual(fallback);
    expect(fallback.lines.find(line => line.key === 'bank_deposit')?.value).toBe('0.25%');
    expect(fallback.lines.find(line => line.key === 'fx')?.value).toBe('Free');
  });
});

describe('membership offer presentation', () => {
  it('quotes actual endpoint prices and lock amounts instead of invented defaults', () => {
    expect(tierOfferRows(offer())).toEqual([
      { label: 'Annual membership', value: '$149.5/year' },
      { label: 'Or lock FUSE', value: '37.5K FUSE' },
    ]);
    expect(tierOfferSubtitle(offer())).toBe('$149.5/year or 37.5K FUSE locked');
  });

  it('does not invent an offer when membership data or available routes are missing', () => {
    expect(tierOfferRows(undefined)).toEqual([]);
    expect(tierOfferSubtitle(undefined)).toBeNull();
    const unavailable = offer({ cashAvailable: false, lockAvailable: false });
    expect(tierOfferRows(unavailable)).toEqual([]);
    expect(tierOfferSubtitle(unavailable)).toBeNull();
    expect(tierOfferRows(offer({ annualFeeUsd: null, lockFuse: 0 }))).toEqual([]);
  });

  it('shows only the route actually on sale', () => {
    expect(tierOfferSubtitle(offer({ cashAvailable: false }))).toBe('Requires 37.5K FUSE locked');
    expect(tierOfferSubtitle(offer({ lockAvailable: false }))).toBe('$149.5/year');
  });
});
