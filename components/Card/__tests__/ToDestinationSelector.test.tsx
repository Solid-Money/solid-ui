import React from 'react';

import ToDestinationSelector from '@/components/Card/ToDestinationSelector.shared';
import { CardCollateralTokenBalanceDto } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The asset picker on "Withdraw from card".
 *
 * On web this used to be a portalled dropdown menu rendered over the withdraw
 * sheet: it covered the "Withdraw" button and swallowed taps on its own rows, so
 * a cardholder could neither pick an asset nor reach the button — the "withdraw
 * is not working" report. Both platforms now render the in-flow list this file
 * exercises, and a press on a row has to do three things: name the destination,
 * report the asset, and close the list.
 */

// `@/lib/utils` re-exports wagmi's ESM build, which does not load under
// jest-expo, and only two helpers are used here.
jest.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}));
jest.mock('@/constants/chains', () => ({
  CHAIN_NAMES: { 8453: 'Base', 42161: 'Arbitrum' },
}));
// The store is imported for this enum alone, and reaches MMKV on the way in.
jest.mock('@/store/useCardDepositStore', () => ({
  CardDepositSource: { COLLATERAL: 'collateral' },
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('lucide-react-native', () => ({ ChevronDown: 'ChevronDown', Wallet: 'Wallet' }));

const asset = (
  overrides: Partial<CardCollateralTokenBalanceDto>,
): CardCollateralTokenBalanceDto => ({
  rainCollateralContractId: 'c1',
  chainId: 8453,
  collateralProxy: '0xproxy',
  tokenAddress: '0xtoken',
  symbol: 'USDC',
  decimals: 6,
  rawBalance: '0',
  balanceUsd: 0,
  ...overrides,
});

/** What the cardholder in the support recording actually held. */
const USDC = asset({ symbol: 'USDC', tokenAddress: '0xusdc', balanceUsd: 30.04 });
const USDT = asset({ symbol: 'USDT', tokenAddress: '0xusdt', balanceUsd: 5.01 });
const EMPTY_USDC = asset({ symbol: 'USDC', tokenAddress: '0xusdc2', chainId: 42161 });
const EMPTY_DAI = asset({ symbol: 'DAI', tokenAddress: '0xdai' });

type Handlers = {
  onChange?: jest.Mock;
  onSelectAsset?: jest.Mock;
};

const render = (
  assets: CardCollateralTokenBalanceDto[],
  { onChange = jest.fn(), onSelectAsset = jest.fn() }: Handlers = {},
  selectedTokenAddress: string | undefined = assets[0]?.tokenAddress,
) => {
  let tree: any;
  act(() => {
    tree = create(
      <ToDestinationSelector
        onChange={onChange}
        assets={assets}
        selectedTokenAddress={selectedTokenAddress}
        onSelectAsset={onSelectAsset}
      />,
    );
  });

  // Matched on props rather than on `Pressable` itself: the host view a Pressable
  // renders carries the same accessibility role but no `onPress`, so this picks
  // out exactly the elements a tap is delivered to, in render order.
  const pressables = () =>
    tree.root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' && node.props?.accessibilityRole === 'button',
    );

  return {
    tree,
    onChange,
    onSelectAsset,
    /** The list is closed until the trigger — the first pressable — is pressed. */
    open: () => act(() => pressables()[0].props.onPress()),
    rows: () => pressables().slice(1),
    labels: () =>
      tree.root
        .findAll((node: any) => node.type === 'Text')
        .flatMap((node: any) => [node.props.children].flat(Infinity))
        .filter((child: any) => typeof child === 'string')
        .join(' | '),
  };
};

test('offers the assets the card holds, not every token its contracts support', () => {
  // Ten rows, eight of them $0, is what buried the two assets this cardholder
  // could actually withdraw.
  const picker = render([USDC, USDT, EMPTY_USDC, EMPTY_DAI]);
  picker.open();

  expect(picker.rows()).toHaveLength(2);
  expect(picker.labels()).toContain('USDT');
  expect(picker.labels()).not.toContain('DAI');

  act(() => picker.tree.unmount());
});

test('picking an asset reports it and closes the list', () => {
  const picker = render([USDC, USDT]);
  picker.open();

  act(() => picker.rows()[1].props.onPress());

  expect(picker.onSelectAsset).toHaveBeenCalledWith(USDT);
  expect(picker.onChange).toHaveBeenCalledWith('collateral');
  // Closed again, so the button underneath it is reachable.
  expect(picker.rows()).toHaveLength(0);

  act(() => picker.tree.unmount());
});

test('names the chain when one symbol would otherwise appear twice', () => {
  const usdcOnArbitrum = asset({
    symbol: 'USDC',
    tokenAddress: '0xusdc2',
    chainId: 42161,
    balanceUsd: 12,
  });
  const picker = render([USDC, usdcOnArbitrum]);
  picker.open();

  expect(picker.labels()).toContain('USDC · Base');
  expect(picker.labels()).toContain('USDC · Arbitrum');

  act(() => picker.tree.unmount());
});

test('falls back to the default symbol when the card reports no collateral', () => {
  const picker = render([], {}, undefined);
  picker.open();

  expect(picker.rows()).toHaveLength(1);
  expect(picker.labels()).toContain('USDC');

  act(() => picker.tree.unmount());
});
