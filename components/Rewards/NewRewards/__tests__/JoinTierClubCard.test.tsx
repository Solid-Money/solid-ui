import React from 'react';

import JoinTierClubCard from '@/components/Rewards/NewRewards/JoinTierClubCard';
import { RewardsTier, type TierBenefits } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight' }));
jest.mock('@/components/Rewards/NewRewards/SubscriptionBrandBadge', () => ({
  __esModule: true,
  default: 'SubscriptionBrandBadge',
}));
jest.mock('@/hooks/useRewards', () => ({
  useTierBenefits: () => ({ data: mockTierBenefits }),
}));

let mockTierBenefits: TierBenefits[] | undefined;
let root: ReturnType<typeof create>;
const onPress = jest.fn();
const benefits = (tier: RewardsTier, overrides: Partial<TierBenefits> = {}): TierBenefits =>
  ({
    tier,
    cardCashback: { title: '3.5%' },
    yieldBoostPercentage: 2.25,
    subscriptionDiscountRate: 25,
    subscriptionCategoryRates: [
      { key: 'ai', label: 'AI Tools', rate: 12.5 },
      { key: 'rides', label: 'Rides', rate: 7.5 },
    ],
    ...overrides,
  }) as TierBenefits;

const render = (tier: RewardsTier.PRIME | RewardsTier.ULTRA = RewardsTier.PRIME) => {
  act(() => {
    root = create(<JoinTierClubCard tier={tier} onPress={onPress} />);
  });
};
const texts = (): string =>
  root.root
    .findAllByType('Text')
    .map((node: { props: { children: React.ReactNode } }) => [node.props.children].flat().join(''))
    .join('|');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockTierBenefits = [benefits(RewardsTier.PRIME)];
});
afterEach(() => act(() => root?.unmount()));

it('renders configured card cashback, yield and AI while keeping rides hidden', () => {
  render();
  expect(texts()).toContain('3.5% Cashback');
  expect(texts()).toContain('+2.25% Yield boost');
  expect(texts()).toContain('12.5% Cashback on AI');
  expect(texts()).not.toContain('Cashback on rides');
  expect(texts()).not.toContain('25% Cashback on AI');
  expect(texts()).not.toContain('4% Cashback');
});

it('quotes the offered tier when multiple tiers are returned', () => {
  mockTierBenefits = [
    benefits(RewardsTier.CORE, { cardCashback: { title: '2%' } }),
    benefits(RewardsTier.PRIME),
    benefits(RewardsTier.ULTRA, {
      cardCashback: { title: '5%' },
      yieldBoostPercentage: 3,
      subscriptionCategoryRates: [
        { key: 'ai', label: 'AI Tools', rate: 20 },
        { key: 'rides', label: 'Rides', rate: 10 },
      ],
    }),
  ];
  render(RewardsTier.ULTRA);
  expect(texts()).toContain('Join Ultra Club');
  expect(texts()).toContain('5% Cashback');
  expect(texts()).toContain('+3% Yield boost');
  expect(texts()).toContain('20% Cashback on AI');
  expect(texts()).not.toContain('Cashback on rides');
  expect(texts()).not.toContain('50% Cashback on AI');
});

it.each([{ data: undefined }, { data: [] }, { data: [benefits(RewardsTier.ULTRA)] }])(
  'makes no percentage promises while the offered tier data is unavailable',
  ({ data }) => {
    mockTierBenefits = data;
    render();
    expect(texts()).toContain('Join Prime Club');
    expect(texts()).not.toContain('%');
  },
);

it.each([{ categories: [] }, { categories: [{ key: 'music', label: 'Music', rate: 10 }] }])(
  'hides categories omitted by admin config even when the flat rate is positive',
  ({ categories }) => {
    mockTierBenefits = [benefits(RewardsTier.PRIME, { subscriptionCategoryRates: categories })];
    render();
    expect(texts()).not.toContain('Cashback on AI');
    expect(texts()).not.toContain('Cashback on rides');
  },
);

it.each([0, -1, NaN, Infinity])(
  'does not advertise unavailable category and boost rates: %s',
  rate => {
    mockTierBenefits = [
      benefits(RewardsTier.PRIME, {
        yieldBoostPercentage: rate,
        subscriptionCategoryRates: [
          { key: 'ai', label: 'AI Tools', rate },
          { key: 'rides', label: 'Rides', rate },
        ],
      }),
    ];
    render();
    expect(texts()).not.toContain('Yield boost');
    expect(texts()).not.toContain('Cashback on AI');
    expect(texts()).not.toContain('Cashback on rides');
  },
);

it('uses an older API subscription rate for AI', () => {
  mockTierBenefits = [benefits(RewardsTier.PRIME, { subscriptionCategoryRates: undefined })];
  render();
  expect(texts()).toContain('25% Cashback on AI');
  expect(texts()).not.toContain('Cashback on rides');
});

it('updates the category promises when configuration changes', () => {
  render();
  mockTierBenefits = [
    benefits(RewardsTier.PRIME, {
      subscriptionCategoryRates: [
        { key: 'ai', label: 'AI Tools', rate: 18 },
        { key: 'rides', label: 'Rides', rate: 9 },
      ],
    }),
  ];
  act(() => root.update(<JoinTierClubCard tier={RewardsTier.PRIME} onPress={onPress} />));
  expect(texts()).toContain('18% Cashback on AI');
  expect(texts()).not.toContain('12.5% Cashback on AI');
  expect(texts()).not.toContain('Cashback on rides');
});

it('keeps the upgrade action available without loaded benefits', () => {
  mockTierBenefits = undefined;
  render();
  const button = root.root.findAll(
    (node: { props: { accessibilityLabel?: string; onPress?: () => void } }) =>
      node.props.accessibilityLabel === 'Join Prime Club' &&
      typeof node.props.onPress === 'function',
  )[0];
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});
