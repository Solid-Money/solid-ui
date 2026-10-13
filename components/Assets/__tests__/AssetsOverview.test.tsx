import React from 'react';
import { router } from 'expo-router';

import { cashToken, portfolioFixture, spendFixture } from '@/components/Assets/__tests__/fixtures';
import { AssetsOverview } from '@/components/Assets/AssetsScreen';
import HomeAssetsCard from '@/components/Home/NewHome/HomeAssetsCard';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { groupPortfolioCash } from '@/lib/portfolio';

const { act, create } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
}));
jest.mock('@/hooks/usePortfolio', () => ({ usePortfolio: jest.fn() }));
jest.mock('@/hooks/useAnalytics', () => ({
  useMaxAPY: () => ({ maxAPY: 4.5, isAPYsLoading: false }),
}));
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
const textContent = (node = root.root) =>
  node
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
it('opens the existing coin detail for a wallet holding and the position sheet for repayment', () => {
  render();
  press('View USDC');
  expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/coins\/1-/));
  press('View Borrowed');
  expect(root.root.findByType('BorrowPositionSheet').props.isOpen).toBe(true);
});
it('names the share token on Earn rows and opens its coin page', () => {
  render();
  const text = textContent();
  expect(text).toContain('2,365.50 soUSD · backs your credit');
  expect(text).toContain('0.0761 soETH');
  press('View soETH');
  expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/coins\/8453-0x/i));
});
it('shows APY on each earning row while wallet USDC, ETH and FUSE remain without APY', () => {
  render();
  for (const [label, apy] of [
    ['View soUSD', '4.5% APY'],
    ['View soETH', '2.9% APY'],
    ['View Locked FUSE', '2.9% APY'],
  ]) {
    expect(textContent(root.root.findAllByProps({ accessibilityLabel: label })[0])).toContain(apy);
  }
  for (const label of ['View USDC', 'View ETH', 'View FUSE']) {
    expect(textContent(root.root.findAllByProps({ accessibilityLabel: label })[0])).not.toContain(
      'APY',
    );
  }
  expect(textContent()).toContain('$3218.40');
});
it('labels a production share in Crypto without giving an unknown token with the same name APY', () => {
  const cryptoAssets = groupPortfolioCash([
    {
      ...cashToken('soUSD', '24.7749', 1.085, 122),
      commonId: undefined,
      contractAddress: PRODUCTION_VAULT_ADDRESSES.fuse.vault,
    },
    {
      ...cashToken('soUSD', '10', 1, 122),
      commonId: undefined,
      contractAddress: '0x9999999999999999999999999999999999999999',
    },
  ]);
  render({
    cryptoAssets,
    earnAssets: portfolioFixture.earnAssets.map(asset => ({ ...asset, valueUsd: 0 })),
    lockedFuse: 0,
  });
  const rows = root.root.findAllByProps({ accessibilityLabel: 'View soUSD' });
  expect(textContent(rows[0])).toContain('4.5% APY');
  expect(textContent(rows[rows.length - 1])).not.toContain('APY');
  expect(textContent()).toContain('$3218.40');
});
it('keeps the balance visible and marks APY unavailable instead of inventing a rate', () => {
  render({ earnAssets: portfolioFixture.earnAssets.map(asset => ({ ...asset, apy: undefined })) });
  expect(textContent(root.root.findAllByProps({ accessibilityLabel: 'View soUSD' })[0])).toContain(
    'APY —',
  );
  expect(textContent()).not.toContain('0.0% APY');
  expect(textContent()).toContain('$3218.40');
});
it('opens the position sheet for escrow-only shares and Earn when no share is in the wallet', () => {
  render();
  press('View soUSD');
  expect(root.root.findByType('BorrowPositionSheet').props.isOpen).toBe(true);
  expect(router.push).not.toHaveBeenCalled();
  render({
    earnAssets: portfolioFixture.earnAssets.map(asset => ({
      ...asset,
      backsCredit: false,
      walletTokens: [],
      shareNetworkCount: 2,
    })),
  });
  expect(textContent()).toContain('2,365.50 soUSD · 2 networks');
  press('View soUSD');
  expect(router.push).toHaveBeenCalledWith({ pathname: '/savings', params: { vault: 'usdc' } });
});
it('groups holdings as Stablecoins, Earn (with the FUSE lock) and Crypto, in that order', () => {
  render();
  const titles = root.root
    .findAllByType('Text')
    .map((node: any) => node.children.join(''))
    .filter((title: string) => ['Stablecoins', 'Earn', 'Crypto', 'Cash', 'Locked'].includes(title));
  expect(titles).toEqual(['Stablecoins', 'Earn', 'Crypto']);
  const text = textContent();
  expect(text).toContain('180.00 USDC · 3 networks');
  expect(text).toContain('0.0091 ETH');
  expect(text).toContain('1,000.00 FUSE');
  expect(text).toContain('Locked FUSE');
  expect(text).not.toContain('$2990.00');
});
it('shows the yield estimate per day, per month when a day is under a cent, or not at all', () => {
  render();
  expect(textContent()).toContain('+$0.35 / day est.');
  render({ dailyYield: 0.0035, monthlyYield: 0.107 });
  expect(textContent()).toContain('+$0.11 / month est.');
  expect(textContent()).not.toContain('day est.');
  render({ dailyYield: 0.0001, monthlyYield: 0.003 });
  expect(textContent()).not.toContain('est.');
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
const renderHome = (changes = {}) =>
  act(() => {
    root = create(<HomeAssetsCard portfolio={{ ...portfolioFixture, ...changes }} />);
  });
it('shows the three largest holdings on home, products first by value, then Show more', () => {
  renderHome();
  const titles = [
    ...new Set(
      root.root
        .findAll((node: any) => node.props.accessibilityLabel?.startsWith('View '))
        .map((node: any) => node.props.accessibilityLabel),
    ),
  ];
  expect(titles).toEqual(['View USD Yield', 'View ETH Yield', 'View USDC']);
  expect(textContent()).toContain('4.5% APY');
  expect(textContent()).not.toContain('soUSD');
  press('Show all assets');
  expect(router.push).toHaveBeenLastCalledWith('/all-assets');
});
it('opens each home row on its own page', () => {
  renderHome();
  press('View USD Yield');
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/savings', params: { vault: 'usdc' } });
  press('View USDC');
  expect(router.push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/coins\//));
});
it('keeps borrowing off the home card', () => {
  renderHome();
  expect(textContent()).not.toContain('Borrowed');
  expect(textContent()).not.toContain('−$350.00');
});
it('drops Show more when there are three holdings or fewer', () => {
  renderHome({
    earnAssets: portfolioFixture.earnAssets.map(asset => ({ ...asset, valueUsd: 0 })),
    lockedFuse: 0,
    stableAssets: portfolioFixture.stableAssets,
    cryptoAssets: [],
  });
  expect(root.root.findAllByProps({ accessibilityLabel: 'Show all assets' })).toHaveLength(0);
  expect(textContent()).toContain('USDC');
});
it('offers USD Yield to a new account with nothing in it', () => {
  renderHome({
    earnAssets: portfolioFixture.earnAssets.map(asset => ({ ...asset, valueUsd: 0 })),
    lockedFuse: 0,
    stableAssets: [],
    cryptoAssets: [],
  });
  expect(textContent()).toContain('USD Yield');
  expect(textContent()).toContain('Start');
  press('View USD Yield');
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/savings', params: { vault: 'usdc' } });
});
it('shows a share token the savings reads miss as its product, not as soUSD', () => {
  // A development build sees a production soUSD as a wallet token.
  const cryptoAssets = groupPortfolioCash([
    {
      ...cashToken('soUSD', '2000', 1.083, 122),
      commonId: undefined,
      contractAddress: PRODUCTION_VAULT_ADDRESSES.fuse.vault,
    },
  ]);
  renderHome({
    earnAssets: portfolioFixture.earnAssets.map(asset => ({ ...asset, valueUsd: 0 })),
    lockedFuse: 0,
    cryptoAssets,
  });
  expect(textContent()).toContain('USD Yield');
  expect(textContent()).toContain('$2166.00');
  expect(textContent()).toContain('4.5% APY');
  expect(root.root.findAllByProps({ accessibilityLabel: 'View soUSD' })).toHaveLength(0);
});
it('says when balances are unavailable and opens Assets from there', () => {
  renderHome({ isError: true });
  expect(textContent()).toContain('Some balances are unavailable');
});
