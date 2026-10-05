import React from 'react';

import CashbackDetailsCard from '@/components/Activity/CashbackDetailsCard';
import { type CashbackInfo, RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/components/Card/NewCardDetails/icons', () => ({ CashbackDiamondIcon: () => null }));
// The sheet is its own component; here it only has to hand back its trigger.
jest.mock(
  '@/components/Rewards/NewRewards/SubscriptionCashbackSheet',
  () =>
    ({ trigger }: { trigger: React.ReactNode }) =>
      trigger,
);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));

const mockRewards = jest.fn();
jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: () => ({ data: mockRewards() }),
  useTierBenefits: () => ({ data: undefined }),
}));

const subscriptionInfo: CashbackInfo = {
  amount: '+$2.00',
  isPending: false,
  isEscrowed: false,
  isPaid: true,
  isIneligible: false,
  isSubscriptionDiscount: true,
  subscriptionCategory: 'ai',
  payoutAt: '2026-09-17T10:00:00.000Z',
};

const render = (element: React.ReactElement) => {
  let renderer: any;
  act(() => {
    renderer = create(element);
  });
  return renderer;
};

const textOf = (renderer: any) => JSON.stringify(renderer.toJSON());

const toggle = (renderer: any) =>
  renderer.root.findAll(
    (node: any) => node.props.accessibilityState && typeof node.props.onPress === 'function',
  )[0];

describe('CashbackDetailsCard', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRewards.mockReturnValue({
      currentTier: RewardsTier.PRIME,
      cashbackRate: 4,
      subscriptionDiscountRate: 10,
    });
  });

  it('opens collapsed on the figure and what paid it, and expands to the rest', () => {
    const renderer = render(<CashbackDetailsCard info={subscriptionInfo} purchaseUsd={20} />);

    let text = textOf(renderer);
    expect(text).toContain('"+$2.00"');
    expect(text).toContain('"AI subscription"');
    expect(text).toContain('"10%"');
    expect(text).toContain('"Show details"');
    expect(text).not.toContain('"Tier"');
    expect(text).not.toContain('See categories');

    act(() => toggle(renderer).props.onPress());

    text = textOf(renderer);
    expect(text).toContain('"Hide details"');
    expect(text).toContain('"Prime perk"');
    expect(text).toContain('"Paid out"');
    expect(text).toContain('"See categories"');
    expect(text).toContain('" on Streaming, Music and Gaming"');

    act(() => toggle(renderer).props.onPress());
    expect(textOf(renderer)).not.toContain('"Prime perk"');
  });

  it('sends the upsell line to the tier comparison', () => {
    mockRewards.mockReturnValue({ currentTier: RewardsTier.CORE, cashbackRate: 3 });
    const renderer = render(
      <CashbackDetailsCard
        info={{ ...subscriptionInfo, isSubscriptionDiscount: false, amount: '+$3.00' }}
        purchaseUsd={100}
      />,
    );

    act(() => toggle(renderer).props.onPress());
    expect(textOf(renderer)).toContain('"Compare tiers"');

    const link = renderer.root.findAll(
      (node: any) => node.props.accessibilityRole === 'link' && node.props.onPress,
    )[0];
    act(() => link.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/rewards/benefits');
  });

  it('explains an ineligible purchase and offers nothing to expand', () => {
    const renderer = render(
      <CashbackDetailsCard
        info={{
          amount: null,
          isPending: false,
          isEscrowed: false,
          isPaid: false,
          isIneligible: true,
        }}
        purchaseUsd={100}
      />,
    );

    const text = textOf(renderer);
    expect(text).toContain('"Ineligible"');
    expect(text).toContain('don');
    expect(text).not.toContain('"Type"');
    expect(toggle(renderer)).toBeUndefined();
  });

  it('notes that a pending charge does not include the cashback', () => {
    const renderer = render(
      <CashbackDetailsCard info={subscriptionInfo} purchaseUsd={20} isPendingCharge />,
    );
    expect(textOf(renderer)).toContain('not reflected on a pending transaction sum');
  });
});
