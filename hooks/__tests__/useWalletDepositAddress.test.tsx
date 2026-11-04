import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base, fuse, optimism, polygon } from 'viem/chains';

import { useWalletDepositAddress } from '@/hooks/useWalletDepositAddress';
import { createDirectDepositSession } from '@/lib/api';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: SAFE } }),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider.current }),
}));

const SAFE = '0x5afe000000000000000000000000000000005afe';
const mockProvider: { current: CardProvider | null } = { current: null };
const mockCreateSession = createDirectDepositSession as jest.MockedFunction<
  typeof createDirectDepositSession
>;

/** Every answer the hook gave; the last is the current one. */
const seen: ReturnType<typeof useWalletDepositAddress>[] = [];
const current = () => seen[seen.length - 1];
let root: any;
let client: QueryClient;

const mount = async (chainId: number, symbol: string, enabled = true) => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const Probe = () => {
    seen.push(useWalletDepositAddress(chainId, symbol, { enabled }));
    return null;
  };
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockProvider.current = null;
  seen.length = 0;
  mockCreateSession.mockResolvedValue({ walletAddress: '0xabc' } as any);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

describe('useWalletDepositAddress', () => {
  // The old bridge: the backend delivers it to the Safe on Base.
  it('mints a WALLET session for USDT off Fuse', async () => {
    await mount(polygon.id, 'USDT');
    expect(mockCreateSession).toHaveBeenCalledWith(polygon.id, 'USDT', 'WALLET');
    expect(current()).toMatchObject({
      address: '0xabc',
      isMinted: true,
      sessionDestination: 'WALLET',
    });
  });

  it('mints the card session on Fuse for a Wirex cardholder’s dollars', async () => {
    mockProvider.current = CardProvider.WIREX;
    await mount(fuse.id, 'USDC');
    expect(mockCreateSession).toHaveBeenCalledWith(fuse.id, 'USDC', 'RAIN_CARD');
    expect(current()).toMatchObject({ isMinted: true, sessionDestination: 'RAIN_CARD' });
  });

  it('shows the Safe for USDT on Base, minting nothing', async () => {
    await mount(base.id, 'USDT');
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(current()).toMatchObject({ address: SAFE, isMinted: false });
  });

  it('hands out nothing where our pipeline has no address, or the row is not ours', async () => {
    await mount(optimism.id, 'USDT');
    expect(current()?.address).toBeUndefined();
    await act(async () => root.unmount());

    await mount(polygon.id, 'USDT', false);
    expect(current()?.address).toBeUndefined();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
