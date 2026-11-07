import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base, mainnet } from 'viem/chains';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { createDirectDepositSession } from '@/lib/api';

import type { RhinoDepositAssetsResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.assets,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockStore),
}));

const mockRhino: { assets: RhinoDepositAssetsResponse | undefined } = { assets: undefined };
const mockStore = {
  directDepositSession: { selectedToken: 'USDC' } as Record<string, unknown>,
  rhinoDeposit: undefined as unknown,
  setModal: jest.fn(),
  setDirectDepositSession: jest.fn(),
  setRhinoDeposit: jest.fn(),
  resetDepositFlow: jest.fn(),
  setDepositFromSolid: jest.fn(),
};
const mockCreateSession = createDirectDepositSession as jest.MockedFunction<
  typeof createDirectDepositSession
>;

/** rhino.fi takes USDC from Ethereum into soUSD; Base pays out on Base, so it has no route. */
const ASSETS: RhinoDepositAssetsResponse = {
  enabled: true,
  chains: [
    {
      chain: 'ETHEREUM',
      chainId: mainnet.id,
      name: 'Ethereum',
      addressType: 'EVM',
      tokens: [
        {
          symbol: 'USDC',
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          routes: [
            {
              destinationType: 'PROTOCOL',
              receiveSymbol: 'USDC',
              receiveChainId: base.id,
              vault: 'soUSD',
              minimumUsd: 5,
              maximumUsd: 100000,
            },
          ],
        },
      ],
    },
  ],
};

/** Every answer the hook gave; the last is the current one. */
const seen: ReturnType<typeof useSavingsFundFlow>[] = [];
const flow = () => seen[seen.length - 1];
let root: any;
let client: QueryClient;

const mount = () => {
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const Probe = () => {
    seen.push(useSavingsFundFlow());
    return null;
  };
  act(() => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
};

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  seen.length = 0;
  mockRhino.assets = ASSETS;
  mockStore.rhinoDeposit = undefined;
  mockCreateSession.mockResolvedValue({ walletAddress: '0xabc', clientTxId: 'c1' } as any);
});

afterEach(() => {
  act(() => root?.unmount());
  client?.clear();
});

describe('useSavingsFundFlow, rhino.fi first', () => {
  it('shows the rhino.fi address for a row rhino.fi serves, minting no session', async () => {
    mount();
    act(() => flow().selectNetwork(mainnet.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith({
      chain: 'ETHEREUM',
      tokenSymbol: 'USDC',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
      fallbackChainId: mainnet.id,
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
  });

  it('keeps the direct-deposit session for a row rhino.fi does not serve', async () => {
    mount();
    act(() => flow().selectNetwork(base.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(undefined);
    expect(mockCreateSession).toHaveBeenCalledWith(base.id, 'USDC', 'PROTOCOL');
  });

  it('changes nothing for someone rhino.fi is not offered to', async () => {
    mockRhino.assets = undefined;
    mount();
    act(() => flow().selectNetwork(mainnet.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(undefined);
    expect(mockCreateSession).toHaveBeenCalledWith(mainnet.id, 'USDC', 'PROTOCOL');
  });

  it('falls back to the row’s own session when the rhino.fi address fails', async () => {
    mockStore.rhinoDeposit = {
      chain: 'ETHEREUM',
      tokenSymbol: 'USDC',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
      fallbackChainId: mainnet.id,
    };
    mount();
    act(() => flow().fallBackFromRhino());
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(undefined);
    expect(mockCreateSession).toHaveBeenCalledWith(mainnet.id, 'USDC', 'PROTOCOL');
  });

  it('has nothing to fall back to for a selection without a row', async () => {
    mockStore.rhinoDeposit = { chain: 'TRON', tokenSymbol: 'USDT', destinationType: 'PROTOCOL' };
    mount();
    act(() => flow().fallBackFromRhino());
    await settle();

    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
