import React from 'react';
import { router } from 'expo-router';
import { fuse } from 'viem/chains';

import CoinEarnLink from '@/components/Coin/CoinEarnLink';
import CoinSummary from '@/components/Coin/CoinSummary';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { TokenBalance } from '@/lib/types';
import { getEarningTokenVault } from '@/lib/vaults';

const { act, create } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/useAnalytics', () => ({
  useMaxAPY: () => ({ maxAPY: 4.5, isAPYsLoading: false }),
}));
jest.mock('@/hooks/useVaultExchangeRate', () => ({
  useVaultExchangeRate: () => ({ data: 1.083021 }),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/RenderTokenIcon', () => 'TokenIcon');
jest.mock('@/components/Coin/CoinBackButton', () => 'CoinBackButton');
jest.mock('@/components/Earn/YieldIcon', () => 'YieldIcon');
jest.mock('@/lib/utils', () => ({
  formatBalanceUSD: (value: number) => `$${value.toFixed(2)}`,
  formatNumber: (value: number, max = 2, min = 0) =>
    value.toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: min }),
}));
jest.mock('@/lib/getTokenIcon', () => () => ({ type: 'image', source: 'token-icon' }));
jest.mock('@/components/Earn/EarnChips', () => ({
  EarnChip: ({ label }: { label: string }) =>
    jest.requireActual('react').createElement('Text', null, label),
}));

const token = (overrides: Partial<TokenBalance>) =>
  ({
    chainId: fuse.id,
    contractDecimals: 6,
    balance: '0',
    quoteRate: 1,
    ...overrides,
  }) as TokenBalance;

// A real (production) soUSD, as a development build sees it: not one of its configured
// shares, but still soUSD.
const productionSoUsd = token({
  contractAddress: PRODUCTION_VAULT_ADDRESSES.fuse.vault,
  contractTickerSymbol: 'soUSD',
  contractName: 'soUSD',
});
const usdc = token({
  contractAddress: '0x28C3d1cD466Ba22f6cae51b1a4692a831696391A',
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
});
const breakdown = (symbol: string) => ({
  symbol,
  totalBalance: 24.7749,
  totalBalanceUSD: 26.83,
  items: [],
});

let root: any;
const textContent = () =>
  root.root
    .findAllByType('Text')
    .map((node: any) => node.children.filter((item: any) => typeof item === 'string').join(''))
    .join(' ');
const render = (coin: TokenBalance) => {
  const shareVault = getEarningTokenVault(coin);
  act(() => {
    root = create(
      <>
        <CoinSummary
          token={coin}
          breakdown={breakdown(coin.contractTickerSymbol)}
          shareVault={shareVault}
        />
        <CoinEarnLink shareVault={shareVault} />
      </>,
    );
  });
};
afterEach(() => {
  act(() => root?.unmount());
  jest.clearAllMocks();
});

it('shows a production soUSD as a USD Yield share, with its rate and a way to the product', () => {
  render(productionSoUsd);
  // The header shows the share (live dot); the link below shows the product it belongs to.
  const [header, link] = root.root.findAllByType('YieldIcon');
  expect(header.props.badge).toBe('live');
  expect(link.props.badge).toBeUndefined();
  expect(textContent()).toContain('24.7749 soUSD');
  expect(textContent()).toContain('4.5% APY');
  expect(textContent()).toContain('1 soUSD = $1.0830');
  expect(textContent()).toContain('Part of USD Yield');
  expect(textContent()).toContain('Withdraw or manage in Earn');

  const opens = root.root.findAllByProps({ accessibilityLabel: 'Open USD Yield' });
  act(() => opens[0].props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/savings', params: { vault: 'usdc' } });
});

it('gives a plain coin no APY and no product link', () => {
  render(usdc);
  expect(root.root.findAllByType('YieldIcon')).toHaveLength(0);
  expect(textContent()).toContain('USD Coin');
  expect(textContent()).not.toContain('APY');
  expect(textContent()).not.toContain('Part of');
});
