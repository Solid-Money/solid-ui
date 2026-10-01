import {
  formatTierYieldBoost,
  resolveTierYieldBoostRate,
  TIER_YIELD_BOOST_RATES,
} from '@/lib/tierYieldBoost';
import { RewardsTier, TierBenefit, TierBenefits } from '@/lib/types';

const BENEFIT: TierBenefit = { title: 'Base yield' };

const benefitsFor = (tier: RewardsTier, yieldBoostPercentage?: number): TierBenefits => ({
  tier,
  depositBoost: BENEFIT,
  yieldBoostPercentage,
  cardCashback: BENEFIT,
  subscriptionDiscount: null,
  cardCashbackCap: BENEFIT,
  subscriptionDiscountCap: null,
  cardFees: BENEFIT,
  bankDeposit: BENEFIT,
  swapFees: BENEFIT,
  support: BENEFIT,
});

/**
 * The tier screens used to print their own yield boost constants, which had drifted
 * from the figure the rewards home reads off the API, and from each other. Every
 * surface resolves through this now, so the live rate is the one answer and the table
 * is only what fills the gap before it lands.
 */
describe('resolveTierYieldBoostRate', () => {
  it('prefers the rate the tier-benefits endpoint sent', () => {
    const benefits = [benefitsFor(RewardsTier.PRIME, 2), benefitsFor(RewardsTier.ULTRA, 7)];

    expect(resolveTierYieldBoostRate(RewardsTier.ULTRA, benefits)).toBe(7);
    expect(resolveTierYieldBoostRate(RewardsTier.PRIME, benefits)).toBe(2);
  });

  it('takes a live zero as an answer rather than falling back', () => {
    // A tier whose boost has been switched off in admin config. Reading 0 as "missing"
    // would keep advertising a boost that no longer pays out.
    const benefits = [benefitsFor(RewardsTier.ULTRA, 0)];

    expect(resolveTierYieldBoostRate(RewardsTier.ULTRA, benefits)).toBe(0);
  });

  it('falls back to the table while the request is in flight', () => {
    expect(resolveTierYieldBoostRate(RewardsTier.ULTRA)).toBe(
      TIER_YIELD_BOOST_RATES[RewardsTier.ULTRA],
    );
    expect(resolveTierYieldBoostRate(RewardsTier.CORE, [])).toBe(0);
  });

  it('falls back when the backend omits the structured rate', () => {
    // An older backend sends `depositBoost` prose and no `yieldBoostPercentage`.
    const benefits = [benefitsFor(RewardsTier.ULTRA)];

    expect(resolveTierYieldBoostRate(RewardsTier.ULTRA, benefits)).toBe(
      TIER_YIELD_BOOST_RATES[RewardsTier.ULTRA],
    );
  });

  it('matches the rates the accounts service pays from', () => {
    // `YIELD_BOOST_DEFAULTS` in the accounts service, as APYs: tier1 0, tier2 0.02,
    // tier3 0.03 — percentage points here, so Core 0, Prime 2, Ultra 3.
    expect(TIER_YIELD_BOOST_RATES).toEqual({
      [RewardsTier.CORE]: 0,
      [RewardsTier.PRIME]: 2,
      [RewardsTier.ULTRA]: 3,
    });
  });
});

describe('formatTierYieldBoost', () => {
  it('prints the rate the way the tier screens do', () => {
    expect(formatTierYieldBoost(3)).toBe('+3%');
    expect(formatTierYieldBoost(0)).toBe('+0%');
  });
});
