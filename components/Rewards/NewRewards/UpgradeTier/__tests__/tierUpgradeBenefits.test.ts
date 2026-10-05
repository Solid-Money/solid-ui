import {
  findTierBenefits,
  resolveTierUpgradeBenefits,
} from '@/components/Rewards/NewRewards/UpgradeTier/tierUpgradeBenefits';
import { RewardsTier, type TierBenefits } from '@/lib/types';

const categoryRates = (rates: Record<string, number>) =>
  Object.entries(rates).map(([key, rate]) => ({ key, label: key, rate }));

const primeBenefits = (overrides: Partial<TierBenefits> = {}): TierBenefits =>
  ({
    tier: RewardsTier.PRIME,
    cardCashback: { title: '3%' },
    depositBoost: { title: 'Base yield + 2% APY' },
    subscriptionDiscount: { title: 'Up to 10% back on 2 categories' },
    subscriptionDiscountRate: 10,
    subscriptionCategoryRates: categoryRates({ ai: 10, streaming: 10, music: 10, rides: 8 }),
    cardCashbackCap: { title: 'Up to $100\nmonthly' },
    ...overrides,
  }) as TierBenefits;

const categoryBenefits = (benefits: TierBenefits) =>
  resolveTierUpgradeBenefits(benefits).filter(line => ['subscription', 'rides'].includes(line.key));

it('replaces the category limit copy with named subscription and rides benefits', () => {
  expect(resolveTierUpgradeBenefits(primeBenefits())).toEqual([
    { key: 'cashback', label: '3% cashback' },
    { key: 'yield-boost', label: 'Base yield + 2% APY yield boost' },
    { key: 'subscription', label: '10% on AI, streaming and music' },
    { key: 'rides', label: '8% on rides' },
    { key: 'cashback-cap', label: '$100 monthly cashback cap' },
  ]);
});

it('quotes the selected tier and its configured rates', () => {
  const ultra = primeBenefits({
    tier: RewardsTier.ULTRA,
    cardCashback: { title: '5%' },
    depositBoost: { title: 'Base yield + 3% APY' },
    subscriptionCategoryRates: categoryRates({ ai: 20, streaming: 20, music: 20, rides: 10 }),
    cardCashbackCap: { title: 'Up to $200\nmonthly' },
  });
  expect(
    resolveTierUpgradeBenefits(findTierBenefits([primeBenefits(), ultra], RewardsTier.ULTRA)),
  ).toEqual([
    { key: 'cashback', label: '5% cashback' },
    { key: 'yield-boost', label: 'Base yield + 3% APY yield boost' },
    { key: 'subscription', label: '20% on AI, streaming and music' },
    { key: 'rides', label: '10% on rides' },
    { key: 'cashback-cap', label: '$200 monthly cashback cap' },
  ]);
});

it('does not claim one shared rate when subscription category rates differ', () => {
  expect(
    categoryBenefits(
      primeBenefits({
        subscriptionCategoryRates: categoryRates({
          ai: 12.5,
          streaming: 10,
          music: 10,
          rides: 7.5,
        }),
      }),
    ),
  ).toEqual([
    { key: 'subscription', label: '12.5% on AI\n10% on streaming and music' },
    { key: 'rides', label: '7.5% on rides' },
  ]);
});

it('omits categories paused or removed from the backend', () => {
  expect(
    categoryBenefits(
      primeBenefits({ subscriptionCategoryRates: categoryRates({ streaming: 10, rides: 0 }) }),
    ),
  ).toEqual([{ key: 'subscription', label: '10% on streaming' }]);
  expect(categoryBenefits(primeBenefits({ subscriptionCategoryRates: [] }))).toEqual([]);
});

it.each([0, -1, NaN, Infinity])('does not advertise invalid or locked rates: %s', rate => {
  expect(
    categoryBenefits(
      primeBenefits({ subscriptionCategoryRates: categoryRates({ ai: rate, rides: rate }) }),
    ),
  ).toEqual([]);
});

it('uses an older backend flat rate for subscriptions without inventing a rides rate', () => {
  expect(
    categoryBenefits(
      primeBenefits({ subscriptionCategoryRates: undefined, subscriptionDiscountRate: 25 }),
    ),
  ).toEqual([{ key: 'subscription', label: '25% on AI, streaming and music' }]);
});

it('makes no category promises before benefits are available', () => {
  expect(resolveTierUpgradeBenefits(undefined)).toEqual([]);
});
