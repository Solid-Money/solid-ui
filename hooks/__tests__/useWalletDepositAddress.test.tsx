import React from 'react';

import { useWalletDepositAddress } from '@/hooks/useWalletDepositAddress';
import { CardProvider } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');

const SAFE = '0x00000000000000000000000000000000000005af';
const MINTED = '0x000000000000000000000000000000000000d1d0';

let mockProvider: CardProvider | null;
let mockQueryOptions: { enabled?: boolean } | undefined;

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: { enabled?: boolean }) => {
    mockQueryOptions = options;
    return options.enabled
      ? { data: { walletAddress: MINTED }, isLoading: false, isError: false }
      : { data: undefined, isLoading: false, isError: false };
  },
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: SAFE } }),
}));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: jest.fn() }));
// The deposit constants pull in the image bundle, which needs native modules.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/components/Card/CardFund/constants', () => ({
  CARD_FUND_DESTINATION_TYPE: 'RAIN_CARD',
}));

type Result = ReturnType<typeof useWalletDepositAddress>;

const render = (symbol: string, options?: { toSafe?: boolean }): Result => {
  const seen: Result[] = [];
  const Probe = () => {
    seen.push(useWalletDepositAddress(8453, symbol, options));
    return null;
  };
  act(() => {
    create(<Probe />);
  });
  return seen[seen.length - 1];
};

beforeEach(() => {
  mockProvider = null;
  mockQueryOptions = undefined;
});

describe('useWalletDepositAddress', () => {
  it("gives a Wirex cardholder's USDC the address minted for the card", () => {
    mockProvider = CardProvider.WIREX;
    expect(render('USDC')).toEqual({
      address: MINTED,
      isLoading: false,
      isError: false,
      isMinted: true,
    });
    expect(mockQueryOptions?.enabled).toBe(true);
  });

  it('gives a Wirex cardholder the Safe when the flow funds the Safe itself', () => {
    // The AI API "Add funds" case: USDC sent to the card's address is bridged
    // to Fuse, where the AI API's charge on Base cannot reach it.
    mockProvider = CardProvider.WIREX;
    expect(render('USDC', { toSafe: true })).toEqual({
      address: SAFE,
      isLoading: false,
      isError: false,
      isMinted: false,
    });
    // Nothing is minted for it.
    expect(mockQueryOptions?.enabled).toBe(false);
  });

  it('gives everyone without a Wirex card the Safe either way', () => {
    expect(render('USDC').address).toBe(SAFE);
    expect(render('USDC', { toSafe: true }).address).toBe(SAFE);
    mockProvider = CardProvider.RAIN;
    expect(render('USDC').address).toBe(SAFE);
  });
});
