import React from 'react';

import HomeSpendCashbackTiles from '@/components/Home/NewHome/HomeSpendCashbackTiles';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockOpenCashback = jest.fn();
const mockSheetProps = jest.fn();
const mockTokenPriceUsd = jest.fn();
const USD_REWARDS = {
  cashbackRate: 4,
  cashbackThisMonth: 2.5,
  cashbackPendingThisMonth: 5.1,
  maxCashbackMonthly: 100,
};
let mockRewards: Record<string, unknown> = USD_REWARDS;
let mockCardCashback: Record<string, unknown> = { totalUsdValue: 25 };
let mockMainCurrency: 'USD' | 'EUR' | undefined;
let mockUsdPerEur: number | undefined;

jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: () => ({ data: mockRewards }),
}));
jest.mock('@/hooks/useCardDetails', () => ({
  useCardDetails: () => ({
    data: {
      cashback: mockCardCashback,
      main_currency: mockMainCurrency,
      balances: { available_in_eur: { usd_per_eur: mockUsdPerEur } },
    },
  }),
}));
let mockUnfinishedSwitch: { mode: string; baseMode: string } | null = null;
jest.mock('@/hooks/useUnfinishedSpendModeSwitch', () => ({
  useUnfinishedSpendModeSwitch: () => mockUnfinishedSwitch,
}));
jest.mock('@/hooks/useToken', () => ({
  useTokenPriceUsd: (token: string) => ({ data: mockTokenPriceUsd(token) }),
}));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
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
  mockMainCurrency = undefined;
  mockUsdPerEur = undefined;
  mockTokenPriceUsd.mockReset();
  jest.clearAllMocks();
});

test('shows spendable cash and earned plus pending cashback', () => {
  const tree = render();
  expect(texts(tree)).toEqual(
    expect.arrayContaining(['Cash mode', '$1,120.00', '4% Cashback', '+$7.60']),
  );
  act(() => tree.unmount());
});

test('warns when a mode change left part of the balance on the old mode', () => {
  mockUnfinishedSwitch = { mode: 'credit', baseMode: 'cash' };
  const tree = render({ mode: 'credit' });
  expect(texts(tree)).toContain('Partly on Cash');
  expect(texts(tree)).not.toContain('Credit mode');
  const tile = tree.root.findAll(
    (node: any) =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.includes('Available to spend'),
  )[0];
  expect(tile.props.accessibilityLabel).toContain(
    'The change did not finish: part of your balance is still on Cash.',
  );
  // The tile opens the spend-mode sheet, which offers to finish the change.
  act(() => tile.props.onPress());
  expect(useCardPaneStore.getState().isSpendModeOpen).toBe(true);
  act(() => tree.unmount());
  mockUnfinishedSwitch = null;
});

test('shows the mode alone when the change finished', () => {
  const tree = render({ mode: 'credit' });
  expect(texts(tree)).toContain('Credit mode');
  expect(texts(tree).some((text: string) => text.startsWith('Partly on'))).toBe(false);
  act(() => tree.unmount());
});

test('hands the cashback sheet dollar figures for a dollar cardholder', () => {
  const tree = render();
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'USD',
      monthlyCashbackLabel: '$7.60',
      monthlyCapLabel: '$100',
      allTimeCashbackLabel: '$25.00',
    }),
  );
  expect(mockTokenPriceUsd).toHaveBeenLastCalledWith('');
  act(() => tree.unmount());
});

test('converts dollar cashback to euros and uses the configured euro cap', () => {
  mockUsdPerEur = 1.25;
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
  expect(texts(tree)).toContain('+€8.08');
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'EUR',
      monthlyCashbackLabel: '€8.08',
      monthlyCapLabel: '€50',
      tierMonthlyCapLabel: undefined,
      allTimeCashbackLabel: '€29.00',
    }),
  );
  expect(mockTokenPriceUsd).toHaveBeenLastCalledWith('');
  act(() => tree.unmount());
});

test.each([
  [3, '€2.40'],
  [0, '€0.00'],
] as const)('shows %s pending dollars on a euro card as %s', (pendingUsd, expected) => {
  mockUsdPerEur = 1.25;
  mockRewards = {
    ...USD_REWARDS,
    cashbackCurrency: 'EUR',
    cashbackThisMonth: 0,
    cashbackPendingThisMonth: pendingUsd,
    cashbackEur: { cashbackThisMonth: 0, cashbackPendingThisMonth: 0, maxCashbackMonthly: 100 },
  };
  const tree = render();
  expect(texts(tree)).toContain(`+${expected}`);
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      monthlyCashbackLabel: expected,
      allTimeCashbackLabel: '€20.00',
    }),
  );
  act(() => tree.unmount());
});

test('converts euro cashback to dollars immediately after switching the card to USD', () => {
  mockMainCurrency = 'USD';
  mockTokenPriceUsd.mockReturnValue('1.20');
  mockCardCashback = { totalUsdValue: 25, eur: { totalEurValue: 9 } };
  mockRewards = {
    ...USD_REWARDS,
    cashbackCurrency: 'EUR',
    cashbackEur: { cashbackThisMonth: 1, cashbackPendingThisMonth: 3, maxCashbackMonthly: 50 },
  };
  const tree = render();
  expect(texts(tree)).toContain('+$12.40');
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'USD',
      monthlyCashbackLabel: '$12.40',
      monthlyCapLabel: '$100',
      allTimeCashbackLabel: '$35.80',
    }),
  );
  expect(mockTokenPriceUsd).toHaveBeenLastCalledWith('EURC');
  act(() => tree.unmount());
});

test('converts both caps when a euro card has only USD cap data', () => {
  mockMainCurrency = 'EUR';
  mockUsdPerEur = 1.2;
  mockRewards = { ...USD_REWARDS, cashbackCapThisMonth: 150 };

  const tree = render();
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currency: 'EUR',
      monthlyCapLabel: '€125',
      tierMonthlyCapLabel: '€83.33',
    }),
  );
  act(() => tree.unmount());
});

test('omits only figures that need an unavailable exchange rate', () => {
  mockRewards = {
    ...USD_REWARDS,
    cashbackEur: { cashbackThisMonth: 0, cashbackPendingThisMonth: 3 },
  };
  mockUsdPerEur = 0;

  const tree = render();
  expect(texts(tree)).toContain('—');
  expect(mockSheetProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      monthlyCashbackLabel: undefined,
      monthlyCapLabel: '$100',
      allTimeCashbackLabel: '$25.00',
    }),
  );
  expect(mockTokenPriceUsd).toHaveBeenLastCalledWith('EURC');
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

test('shows a skeleton while the spendable balance loads', () => {
  const tree = render({ isLoading: true, cashBalance: '$0.00' });
  expect(tree.root.findAllByType('Skeleton')).toHaveLength(1);
  expect(texts(tree)).toContain('Available to spend');
  expect(texts(tree)).not.toContain('$0.00');
  act(() => tree.unmount());
});
