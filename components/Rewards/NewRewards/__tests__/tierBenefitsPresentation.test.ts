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
    expect(content.perks[1].description).toBe('25% on subscriptions');
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
    expect(content.perks[1].description).toBe('0% on subscriptions');
  });

  it.each([CORE, PRIME, ULTRA])('keeps the design when %s numerical fields are absent', tier => {
    expect(tierPresentationContent(tier)).toEqual(TIER_PRESENTATION[tier]);
    expect(tierPresentationContent(tier, benefits(tier))).toEqual(TIER_PRESENTATION[tier]);
  });

  it('uses a partial live response without replacing other design fallback values', () => {
    const content = tierPresentationContent(
      ULTRA,
      benefits(ULTRA, { subscriptionDiscountRate: 50 }),
    );
    expect(content.subscriptionRate).toBe('50%');
    expect(content.stats).toContainEqual({ value: '+3%', label: 'Yield boost' });
    expect(content.perks[0].description).toBe('+3% APY on up to $25K in savings');
    expect(content.perks[1].description).toBe('50% on subscriptions');
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
