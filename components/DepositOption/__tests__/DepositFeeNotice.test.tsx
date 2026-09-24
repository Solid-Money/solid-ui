import React from 'react';
import { base, fuse, mainnet } from 'viem/chains';

import DepositFeeNotice from '@/components/DepositOption/DepositFeeNotice';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const FEE_LINE = '0.03% fee will be charged for deposits on this network';

const render = (element: React.ReactElement) => {
  let tree: any;
  act(() => {
    tree = create(element);
  });
  const texts = tree.root.findAllByType('Text').map((node: any) => node.props.children);
  act(() => tree.unmount());
  return texts;
};

test('warns a Rain cardholder funding their card off Base, and not on it', () => {
  const notice = (chainId: number) =>
    render(
      <DepositFeeNotice
        product="card"
        provider={CardProvider.RAIN}
        chainId={chainId}
        symbol="USDC"
      />,
    );

  expect(notice(mainnet.id)).toEqual([FEE_LINE]);
  expect(notice(fuse.id)).toEqual([FEE_LINE]);
  expect(notice(base.id)).toEqual([]);
});

test('warns a Wirex cardholder sending a stablecoin to the wallet off Fuse, and only then', () => {
  const notice = (chainId: number, symbol: string) =>
    render(
      <DepositFeeNotice
        product="wallet"
        provider={CardProvider.WIREX}
        chainId={chainId}
        symbol={symbol}
      />,
    );

  expect(notice(base.id, 'USDC')).toEqual([FEE_LINE]);
  expect(notice(mainnet.id, 'USDT')).toEqual([FEE_LINE]);
  expect(notice(fuse.id, 'USDC')).toEqual([]);
  expect(notice(mainnet.id, 'ETH')).toEqual([]);
});

test('shows nothing on the wallet deposit to someone with no card', () => {
  expect(
    render(
      <DepositFeeNotice product="wallet" provider={null} chainId={mainnet.id} symbol="USDC" />,
    ),
  ).toEqual([]);
});

test("follows the vault's chain on a savings deposit", () => {
  const notice = (chainId: number) =>
    render(
      <DepositFeeNotice
        product="savings"
        provider={CardProvider.RAIN}
        chainId={chainId}
        vaultToken="soUSD"
      />,
    );

  expect(notice(mainnet.id)).toEqual([]);
  expect(notice(base.id)).toEqual([FEE_LINE]);
});
