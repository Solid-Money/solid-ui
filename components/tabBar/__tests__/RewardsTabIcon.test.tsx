import React from 'react';

import { RewardsTabIcon } from '@/components/tabBar/RewardsTabIcon';
import { useRewardsSeenStore } from '@/store/useRewardsSeenStore';

import type { CardCreditSummary } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

// MMKV is a native module — back the persisted store with plain memory here.
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

let mockCredit: CardCreditSummary | undefined;
let mockReduceMotion = false;
const mockPops: unknown[] = [];

jest.mock('@/hooks/useCardCredit', () => ({
  useCardCredit: () => ({ data: mockCredit }),
}));
jest.mock('@/hooks/useRewards', () => ({
  useReferralV4Summary: () => ({ data: undefined }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (select: (state: unknown) => unknown) =>
    select({ users: [{ userId: 'user-1', selected: true }] }),
}));
jest.mock('@/components/tabBar/AnimatedTabIcon', () => ({ AnimatedTabIcon: () => null }));
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: () => {},
    Easing: { bezier: () => () => 0 },
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => mockReduceMotion,
    useSharedValue: (value: unknown) => ({ value }),
    withSequence: (...steps: unknown[]) => {
      mockPops.push(steps);
      return steps;
    },
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

const credit = (newestGrantAt: string): CardCreditSummary => ({
  availableUsd: 10,
  pendingUsd: 0,
  lifetimeGrantedUsd: 10,
  lifetimeSpentUsd: 0,
  spendable: true,
  sources: [
    {
      id: newestGrantAt,
      type: 'admin_grant',
      amountUsd: 10,
      label: 'Solid team',
      createdAt: newestGrantAt,
    },
  ],
});

function render(focused = false) {
  let renderer: any;
  act(() => {
    renderer = create(<RewardsTabIcon focused={focused} />);
  });
  return {
    update: (nextFocused = focused) =>
      act(() => renderer.update(<RewardsTabIcon focused={nextFocused} />)),
    unmount: () => act(() => renderer.unmount()),
  };
}

describe('RewardsTabIcon pop', () => {
  beforeEach(() => {
    mockCredit = undefined;
    mockReduceMotion = false;
    mockPops.length = 0;
    useRewardsSeenStore.setState({ seenByUserId: {} });
  });

  it('stays still on a first launch, then pops once for a new credit', () => {
    mockCredit = credit('2026-10-20T10:00:00Z');
    const icon = render();
    expect(mockPops).toHaveLength(0);

    mockCredit = credit('2026-10-27T10:00:00Z');
    icon.update();
    expect(mockPops).toHaveLength(1);

    // Re-renders and remounts with the same data never replay it.
    icon.update();
    icon.update();
    icon.unmount();
    render();
    expect(mockPops).toHaveLength(1);
  });

  it('marks a credit seen without popping while the Rewards tab is open', () => {
    mockCredit = credit('2026-10-20T10:00:00Z');
    const icon = render(true);
    mockCredit = credit('2026-10-27T10:00:00Z');
    icon.update(true);
    icon.update(false);
    expect(mockPops).toHaveLength(0);
  });

  it('skips the animation with reduced motion', () => {
    mockReduceMotion = true;
    mockCredit = credit('2026-10-20T10:00:00Z');
    const icon = render();
    mockCredit = credit('2026-10-27T10:00:00Z');
    icon.update();
    expect(mockPops).toHaveLength(0);
  });
});
