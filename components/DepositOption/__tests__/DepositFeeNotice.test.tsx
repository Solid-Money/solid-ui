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

type QuoteState = {
  data?: { applies: boolean; ratePpm: number };
  isError: boolean;
};

// The backend's answer. Charges the 0.03% default unless a test says otherwise,
// so the rule tests below show which deposits are never asked about at all.
let mockQuote: QuoteState;
const mockUseDepositFeeQuote = jest.fn((_params: unknown) => mockQuote);
jest.mock('@/hooks/useDepositFeeQuote', () => ({
  useDepositFeeQuote: (params: unknown) => mockUseDepositFeeQuote(params),
}));

beforeEach(() => {
  mockQuote = { data: { applies: true, ratePpm: 300 }, isError: false };
  mockUseDepositFeeQuote.mockClear();
});

const feeLine = (percent: string) => `${percent} fee will be charged for deposits on this network`;
const FEE_LINE = feeLine('0.03%');

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

describe('the rate', () => {
  test('is the one the backend quotes for the route and chain', () => {
    mockQuote = { data: { applies: true, ratePpm: 500 }, isError: false };
    expect(rainCardNotice()).toEqual([feeLine('0.05%')]);
  });

  test('is left off when the backend would not charge the deposit', () => {
    mockQuote = { data: { applies: false, ratePpm: 0 }, isError: false };
    expect(rainCardNotice()).toEqual([]);
  });

  test('is left off until the backend answers', () => {
    mockQuote = { data: undefined, isError: false };
    expect(rainCardNotice()).toEqual([]);
  });

  test('falls back to the default when the backend cannot be asked', () => {
    mockQuote = { data: undefined, isError: true };
    expect(rainCardNotice()).toEqual([FEE_LINE]);
  });
});

describe('the quote', () => {
  test('is asked of the card address for the card and wallet flows', () => {
    rainCardNotice();
    render(
      <DepositFeeNotice
        product="wallet"
        provider={CardProvider.WIREX}
        chainId={base.id}
        symbol="USDT"
      />,
    );

    expect(mockUseDepositFeeQuote.mock.calls.map(([params]) => params)).toEqual([
      {
        destinationType: 'RAIN_CARD',
        chainId: mainnet.id,
        symbol: 'USDC',
        provider: CardProvider.RAIN,
        enabled: true,
      },
      {
        destinationType: 'RAIN_CARD',
        chainId: base.id,
        symbol: 'USDT',
        provider: CardProvider.WIREX,
        enabled: true,
      },
    ]);
  });

  test('is asked of the savings address for a savings deposit', () => {
    render(
      <DepositFeeNotice
        product="savings"
        provider={CardProvider.RAIN}
        chainId={base.id}
        symbol="USDC"
        vaultToken="soUSD"
      />,
    );

    expect(mockUseDepositFeeQuote).toHaveBeenCalledWith(
      expect.objectContaining({ destinationType: 'PROTOCOL', symbol: 'USDC', enabled: true }),
    );
  });

  test('is not asked for a deposit that is free by rule', () => {
    render(
      <DepositFeeNotice
        product="card"
        provider={CardProvider.RAIN}
        chainId={base.id}
        symbol="USDC"
      />,
    );

    expect(mockUseDepositFeeQuote).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});

function rainCardNotice() {
  return render(
    <DepositFeeNotice
      product="card"
      provider={CardProvider.RAIN}
      chainId={mainnet.id}
      symbol="USDC"
    />,
  );
}
