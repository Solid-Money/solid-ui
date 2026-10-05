import React from 'react';
import { router } from 'expo-router';

import { portfolioFixture, spendFixture } from '@/components/Assets/__tests__/fixtures';
import { AssetsOverview } from '@/components/Assets/AssetsScreen';
import HomeAssetsCard from '@/components/Home/NewHome/HomeAssetsCard';

const { act, create } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
}));
jest.mock('@/hooks/usePortfolio', () => ({ usePortfolio: jest.fn() }));
jest.mock('@/hooks/useActivityRefresh', () => ({ useActivityRefresh: jest.fn() }));
jest.mock('@/hooks/useWirexBankAccounts', () => ({ useWirexUnifiedBalances: jest.fn() }));
jest.mock('@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures', () => ({
  useSpendModeFigures: jest.fn(),
}));
jest.mock(
  '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheet',
  () => 'BorrowPositionSheet',
);
jest.mock(
  '@/components/PageLayout',
  () =>
    function MockPageLayout({ children, additionalContent }: any) {
      return (
        <>
          {children}
          {additionalContent}
        </>
      );
    },
);
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/RenderTokenIcon', () => 'TokenIcon');
jest.mock('@/lib/getTokenIcon', () => () => ({ type: 'image', source: 'token-icon' }));
jest.mock('@/components/BalanceHeadline', () => ({
  BalanceHeadline: ({ balance, label }: any) =>
    jest.requireActual('react').createElement('Text', null, `${label} $${balance.toFixed(2)}`),
}));
jest.mock('@/lib/utils', () => ({
  formatBalanceUSD: (value: number) => `$${value.toFixed(2)}`,
  formatNumber: (value: number) => String(value),
}));
let root: any;
const refresh = jest.fn(async () => {});
const render = (changes = {}) =>
  act(() => {
    root = create(
      <AssetsOverview
        portfolio={{ ...portfolioFixture, ...changes }}
        figures={spendFixture}
        bankBalances={[]}
        refetchAll={refresh}
        isRefreshing={false}
      />,
    );
  });
const press = (label: string) =>
  act(() => root.root.findAllByProps({ accessibilityLabel: label })[0].props.onPress());
const textContent = () =>
  root.root
    .findAllByType('Text')
    .map((node: any) =>
      node.children
        .filter((item: any) => typeof item === 'string' || typeof item === 'number')
        .join(''),
    )
    .join(' ');
afterEach(() => {
  act(() => root?.unmount());
  jest.clearAllMocks();
});

it('renders the reconciled total and keeps small assets collapsed initially', () => {
  render();
  expect(textContent()).toContain('$3218.40');
  expect(textContent()).toContain('$2868.40');
  expect(textContent()).toContain('−$350.00');
  expect(textContent()).toContain('Show 2 small balances');
  expect(textContent()).not.toContain('SMALL1');
  const small = root.root.findAll(
    (node: any) => node.props.onPress && node.props.accessibilityState?.expanded === false,
  )[0];
  act(() => small.props.onPress());
  expect(textContent()).toContain('SMALL1');
  expect(textContent()).toContain('$3218.40');
});
it('hides USD amounts, token quantities and available credit together, and restores them', () => {
  render();
  press('Hide amounts');
  const text = textContent();
  for (const amount of ['3218', '2868', '350.00', '1,650', '10000', '0.0775', '0.0091'])
    expect(text).not.toContain(amount);
  expect(text).toContain('••••');
  press('Show amounts');
  expect(textContent()).toContain('$3218.40');
});
it('opens the existing coin detail for a wallet holding and the position sheet for repayment', () => {
  render();
  press('View USDC');
  expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/coins\/1-/));
  press('View Borrowed');
  expect(root.root.findByType('BorrowPositionSheet').props.isOpen).toBe(true);
});
it('keeps an unavailable total distinct from zero and offers retry', () => {
  render({ isError: true, totalAssets: undefined, netBalance: undefined });
  expect(textContent()).not.toContain('$3218.40');
  expect(textContent()).toContain('—');
  press('Retry balances');
  expect(refresh).toHaveBeenCalledTimes(1);
});
it('does not show invented credit terms or a repayment action while the position is unavailable', () => {
  render({ creditDetailsAvailable: false, isError: true });
  expect(textContent()).toContain('Credit details unavailable');
  expect(textContent()).not.toContain('left to spend');
  expect(textContent()).not.toContain('Repay');
  expect(root.root.findAllByProps({ accessibilityLabel: 'View Borrowed' })).toHaveLength(0);
});
it('returns home when the overview is opened without a navigation history', () => {
  render();
  press('Back');
  expect(router.replace).toHaveBeenCalledWith('/');
});
it('opens the new overview from both the home card and See all', () => {
  act(() => {
    root = create(<HomeAssetsCard portfolio={portfolioFixture} />);
  });
  press('Open assets overview');
  press('See all assets');
  expect(router.push).toHaveBeenCalledTimes(2);
  expect(router.push).toHaveBeenLastCalledWith('/all-assets');
  expect(textContent()).not.toContain('SMALL1');
});
it('shows Borrowed on the home card for a borrower and opens repayment from it', () => {
  const onRepay = jest.fn();
  act(() => {
    root = create(
      <HomeAssetsCard portfolio={portfolioFixture} borrowApy="5.57%" onRepay={onRepay} />,
    );
  });
  expect(textContent()).toContain('5.57% APY · tap to repay');
  expect(textContent()).toContain('−$350.00');
  press('View Borrowed');
  expect(onRepay).toHaveBeenCalledTimes(1);
});
it('offers no repayment from home while the credit position is unavailable', () => {
  act(() => {
    root = create(
      <HomeAssetsCard
        portfolio={{ ...portfolioFixture, creditDetailsAvailable: false }}
        borrowApy="5.57%"
        onRepay={jest.fn()}
      />,
    );
  });
  expect(textContent()).toContain('Credit details unavailable');
  expect(root.root.findAllByProps({ accessibilityLabel: 'View Borrowed' })).toHaveLength(0);
});
it('leaves Earn off the home card when there is nothing in it', () => {
  act(() => {
    root = create(
      <HomeAssetsCard portfolio={{ ...portfolioFixture, earnTotal: 0, debt: 0, earnAssets: [] }} />,
    );
  });
  expect(textContent()).not.toContain('Earn');
  expect(textContent()).toContain('Cash');
  expect(textContent()).not.toContain('Borrowed');
});
it('keeps the known Cash total when the card balance is unavailable', () => {
  act(() => {
    root = create(
      <HomeAssetsCard portfolio={{ ...portfolioFixture, cardBalance: undefined, isError: true }} />,
    );
  });
  expect(textContent()).toContain('$228.40');
  expect(textContent()).toContain('Some balances are unavailable');
});
