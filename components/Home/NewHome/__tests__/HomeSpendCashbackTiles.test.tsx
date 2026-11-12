import React from 'react';

import HomeSpendCashbackTiles from '@/components/Home/NewHome/HomeSpendCashbackTiles';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockOpenCashback = jest.fn();
const mockSheetProps = jest.fn();
const USD_REWARDS = {
  cashbackRate: 4,
  cashbackThisMonth: 2.5,
  cashbackPendingThisMonth: 5.1,
  maxCashbackMonthly: 100,
};
let mockRewards: Record<string, unknown> = USD_REWARDS;
let mockCardCashback: Record<string, unknown> = { totalUsdValue: 25 };

jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: () => ({ data: mockRewards }),
}));
jest.mock('@/hooks/useCardDetails', () => ({
  useCardDetails: () => ({ data: { cashback: mockCardCashback } }),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  formatBalance: (value: number, symbol: string) => `${symbol}${value.toFixed(2)}`,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/Rewards/NewRewards/CashbackDetailsSheet', () => {
  const React = jest.requireActual('react');
  return ({ trigger, ...props }: any) => {
    mockSheetProps(props);
    return React.cloneElement(trigger, { onPress: mockOpenCashback });
  };
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
  mockRewards = USD_REWARDS;
  mockCardCashback = { totalUsdValue: 25 };
  jest.clearAllMocks();
});

test('shows spendable cash and earned plus pending cashback', () => {
  const tree = render();
  expect(texts(tree)).toEqual(
    expect.arrayContaining(['Cash mode', '$1,120.00', '4% Cashback', '+$7.60']),
  );
  act(() => tree.unmount());
});

test('hands the cashback sheet dollar figures for a dollar cardholder', () => {
  const tree = render();
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'USD',
      cashbackThisMonth: 2.5,
      maxCashbackMonthly: 100,
      allTimeCashback: 25,
      allTimeCashbackOther: undefined,
    }),
  );
  act(() => tree.unmount());
});

test("shows a euro cardholder's cashback in euros, never added to dollars", () => {
  mockRewards = {
    ...USD_REWARDS,
    cashbackCurrency: 'EUR',
    cashbackEur: {
      cashbackThisMonth: 1.2,
      cashbackPendingThisMonth: 0.8,
      cashbackLastMonth: 0,
      maxCashbackMonthly: 50,
      cashbackCapThisMonth: 50,
      cashbackHeadroomThisMonth: 48,
    },
  };
  mockCardCashback = { totalUsdValue: 25, currency: 'EUR', eur: { totalEurValue: 9 } };

  const tree = render();
  expect(texts(tree)).toContain('+€2.00');
  expect(texts(tree)).not.toContain('+$7.60');
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'EUR',
      cashbackThisMonth: 1.2,
      cashbackPendingThisMonth: 0.8,
      maxCashbackMonthly: 50,
      tierMonthlyCap: 50,
      allTimeCashback: 9,
      allTimeCashbackOther: { value: 25, currency: 'USD' },
    }),
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
