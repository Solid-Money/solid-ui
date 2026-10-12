import React from 'react';

import ReferralFriendRow from '@/components/Referral/ReferralFriendRow';
import { ReferralFriendStage, type ReferralRewardListItem } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('lucide-react-native', () => ({ ExternalLink: () => null }));
jest.mock('@/hooks/useReferralCountdown', () => ({
  useReferralCountdown: () => ({ label: '3d 4h', isElapsed: false }),
}));
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const chain = { delay: () => chain, duration: () => chain };
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => () => 0, out: () => () => 0, cubic: () => 0 },
    FadeIn: chain,
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ value }),
    withDelay: (_delay: number, value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

const row = (overrides: Partial<ReferralRewardListItem> = {}): ReferralRewardListItem => ({
  referredUserId: 'friend-1',
  username: 'friend',
  stage: ReferralFriendStage.SPENDING,
  status: null,
  signupAt: '2026-10-01T10:00:00.000Z',
  spendUsd: 68.15,
  merchantCount: 2,
  hasActiveCard: true,
  rewardUsd: 25,
  ...overrides,
});

function render(item: ReferralRewardListItem, props: Record<string, unknown> = {}) {
  let renderer: any;
  act(() => {
    renderer = create(
      <ReferralFriendRow
        item={item}
        index={0}
        spendTargetUsd={150}
        merchantTarget={3}
        minMerchantSpendUsd={10}
        activityMinPurchaseUsd={10}
        {...props}
      />,
    );
  });
  return renderer;
}

const textOf = (renderer: any) => JSON.stringify(renderer.toJSON());

describe('ReferralFriendRow — the referral spend rules', () => {
  it('says why spend and merchants are not counting yet', () => {
    const text = textOf(render(row({ merchantsBelowMinimum: 1, excludedSpendUsd: 212.67 })));

    expect(text).toContain('1 merchant needs $10+ to count');
    expect(text).toContain("$212.67 doesn't count");
  });

  it('stays quiet when nothing was left out', () => {
    const text = textOf(render(row({ merchantsBelowMinimum: 0, excludedSpendUsd: 0 })));

    expect(text).not.toContain('to count');
    expect(text).not.toContain("doesn't count");
  });

  it('tells the referrer a qualified friend still needs one more purchase', () => {
    const text = textOf(
      render(
        row({
          stage: ReferralFriendStage.REWARD_UNLOCKING,
          payoutEtaAt: '2026-11-01T02:00:00.000Z',
          awaitingActivity: true,
        }),
      ),
    );

    expect(text).toContain('Needs one more $10+ purchase to unlock');
  });

  it('does not nag once the friend has made it', () => {
    const text = textOf(
      render(
        row({
          stage: ReferralFriendStage.REWARD_UNLOCKING,
          payoutEtaAt: '2026-11-01T02:00:00.000Z',
          awaitingActivity: false,
        }),
      ),
    );

    expect(text).not.toContain('Needs one more');
  });
});
