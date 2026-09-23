import React from 'react';
import { base, fuse, mainnet } from 'viem/chains';

import DepositFeeNotice from '@/components/DepositOption/DepositFeeNotice';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockProvider: CardProvider | null = null;

jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const render = (element: React.ReactElement) => {
  let tree: any;
  act(() => {
    tree = create(element);
  });
  const texts = tree.root.findAllByType('Text').map((node: any) => node.props.children);
  act(() => tree.unmount());
  return texts;
};

afterEach(() => {
  mockProvider = null;
});

test('warns about the fee on a chain the deposit is charged from', () => {
  expect(render(<DepositFeeNotice product="card" chainId={mainnet.id} />)).toEqual([
    '0.03% fee will be charged for deposits on this network',
  ]);
});

test('shows nothing on the chain the deposit is free from', () => {
  expect(render(<DepositFeeNotice product="card" chainId={base.id} />)).toEqual([]);
  expect(
    render(<DepositFeeNotice product="savings" chainId={mainnet.id} vaultToken="soUSD" />),
  ).toEqual([]);
});

test("follows the user's card program", () => {
  mockProvider = CardProvider.WIREX;

  expect(render(<DepositFeeNotice product="card" chainId={fuse.id} />)).toEqual([]);
  expect(render(<DepositFeeNotice product="card" chainId={base.id} />)).toHaveLength(1);
  expect(
    render(<DepositFeeNotice product="savings" chainId={base.id} vaultToken="soUSD" />),
  ).toEqual([]);
});
