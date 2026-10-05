import React from 'react';

import HomeSpendCashbackTiles from '@/components/Home/NewHome/HomeSpendCashbackTiles';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockOpenCashback = jest.fn();

jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: () => ({
    data: {
      cashbackRate: 4,
      cashbackThisMonth: 2.5,
      cashbackPendingThisMonth: 5.1,
      maxCashbackMonthly: 100,
    },
  }),
}));
jest.mock('@/hooks/useCardDetails', () => ({
  useCardDetails: () => ({ data: { cashback: { totalUsdValue: 25 } } }),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  formatBalanceUSD: (value: number) => `$${value.toFixed(2)}`,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/Rewards/NewRewards/CashbackDetailsSheet', () => {
  const React = jest.requireActual('react');
  return ({ trigger }: any) => React.cloneElement(trigger, { onPress: mockOpenCashback });
});

const render = (override: Partial<SpendModeFigures> = {}) => {
  let tree: any;
  act(() => {
    tree = create(
      <HomeSpendCashbackTiles
        figures={{
          mode: 'cash',
          canChangeMode: true,
          cashBalance: '$1,120.00',
          segmentValue: { cash: '$1,120.00', credit: '$1,650.00', smart: '$1,650.00' },
          isLoading: false,
          ...override,
        }}
      />,
    );
  });
  return tree;
};
const texts = (tree: any) =>
  tree.root.findAllByType('Text').map((node: any) => node.children.join(''));

afterEach(() => {
  useCardPaneStore.getState().close();
  jest.clearAllMocks();
});

test('shows spendable cash and earned plus pending cashback', () => {
  const tree = render();
  expect(texts(tree)).toEqual(
    expect.arrayContaining(['Cash mode', '$1,120.00', '4% Cashback', '+$7.60']),
  );
  act(() => tree.unmount());
});

test.each(['credit', 'smart'] as const)('uses the picker availability for %s mode', mode => {
  const tree = render({ mode });
  expect(texts(tree)).toContain('$1,650.00');
  expect(texts(tree)).not.toContain('$1,120.00');
  act(() => tree.unmount());
});

test('opens the mode picker over Home without opening card details', () => {
  const tree = render();
  const mode = tree.root.findAll(
    (node: any) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel?.startsWith('Cash mode'),
  )[0];
  const cashback = tree.root.findAll(
    (node: any) => node.props.accessibilityLabel === 'View cashback details',
  )[0];
  act(() => {
    mode.props.onPress();
    cashback.props.onPress();
  });
  expect(useCardPaneStore.getState()).toMatchObject({
    isSpendModeOpen: true,
    isOpen: false,
    originRect: null,
  });
  expect(mockOpenCashback).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('keeps the balance visible when mode switching is unavailable', () => {
  const tree = render({ canChangeMode: false });
  expect(texts(tree)).toContain('$1,120.00');
  const tile = tree.root.findAll((node: any) =>
    node.props.accessibilityLabel?.startsWith('Cash mode'),
  )[0];
  expect(tile.props.disabled).toBe(true);
  expect(tile.props.accessibilityRole).toBeUndefined();
  act(() => tree.unmount());
});

test('does not report an unresolved spendable balance as zero', () => {
  const tree = render({ isLoading: true, cashBalance: '$0.00' });
  expect(texts(tree)).toContain('—');
  expect(texts(tree)).not.toContain('$0.00');
  act(() => tree.unmount());
});
