import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base, fuse, mainnet, polygon } from 'viem/chains';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockStore),
}));

const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: jest.fn(),
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };
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
  mockRhino.current = READY;
  mockStore.rhinoDeposit = undefined;
  mockCreateSession.mockResolvedValue({ walletAddress: '0xabc', clientTxId: 'c1' } as any);
});

afterEach(() => {
  act(() => root?.unmount());
  client?.clear();
});

describe('useSavingsFundFlow, rhino.fi on every row but Fuse', () => {
  it('shows the rhino.fi address for a row rhino.fi serves, minting no session', async () => {
    mount();
    act(() => flow().selectNetwork(polygon.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith({
      chain: 'MATIC_POS',
      chainId: polygon.id,
      tokenSymbol: 'USDC',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
    expect(track).toHaveBeenCalledWith(
      TRACKING_EVENTS.NETWORK_SELECTED,
      expect.objectContaining({ chain_id: polygon.id, via_rhino: true }),
    );
  });

  // Ethereum is where soUSD pays out: rhino.fi would only pay the USDC back
  // there, so our own savings address puts it in the vault directly.
  it('mints our own savings session for USDC on the vault’s chain', async () => {
    mount();
    act(() => flow().selectNetwork(mainnet.id, 'USDC'));
    await settle();

    expect(mockCreateSession).toHaveBeenCalledWith(mainnet.id, 'USDC', 'PROTOCOL');
    expect(mockStore.setRhinoDeposit).not.toHaveBeenCalledWith(
      expect.objectContaining({ chainId: mainnet.id }),
    );
  });

  it('takes Base through rhino.fi as well', async () => {
    mount();
    act(() => flow().selectNetwork(base.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'BASE', chainId: base.id }),
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('keeps the direct-deposit session for a Fuse row, whatever rhino.fi’s state', async () => {
    mockRhino.current = { status: 'unavailable', retry: jest.fn() };
    mount();
    act(() => flow().selectNetwork(fuse.id, 'USDC'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(undefined);
    expect(mockCreateSession).toHaveBeenCalledWith(fuse.id, 'USDC', 'PROTOCOL');
    expect(track).toHaveBeenCalledWith(
      TRACKING_EVENTS.NETWORK_SELECTED,
      expect.objectContaining({ chain_id: fuse.id, via_rhino: false }),
    );
  });

  // No fallback: a row without a route has no address, and none is minted for it.
  it('does nothing for a row rhino.fi has no route for', async () => {
    mount();
    act(() => flow().selectNetwork(polygon.id, 'ETH'));
    await settle();

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockStore.setRhinoDeposit).not.toHaveBeenCalled();
    expect(mockStore.setModal).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('mints nothing while rhino.fi’s routes load, nor when they cannot be had', async () => {
    for (const status of ['loading', 'unavailable'] as const) {
      mockRhino.current = { status, retry: jest.fn() };
      mount();
      act(() => flow().selectNetwork(mainnet.id, 'USDC'));
      await settle();
      act(() => root.unmount());
    }

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockStore.setModal).not.toHaveBeenCalled();
  });

  it('skips the one-row list once its row has an address', async () => {
    mount();
    act(() => flow().selectToken('WFUSE'));
    await settle();
    expect(mockCreateSession).toHaveBeenCalledWith(fuse.id, 'WFUSE', 'PROTOCOL');
    expect(mockStore.setModal).toHaveBeenLastCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
  });

  // EURC is taken on Ethereum as well as Base now, so there is a choice to make.
  it('lists EURC’s networks, Ethereum among them, both through rhino.fi', async () => {
    mount();
    act(() => flow().selectToken('EURC'));
    await settle();
    expect(mockStore.setModal).toHaveBeenLastCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_NETWORKS);

    act(() => flow().selectNetwork(mainnet.id, 'EURC'));
    await settle();
    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith({
      chain: 'ETHEREUM',
      chainId: mainnet.id,
      tokenSymbol: 'EURC',
      destinationType: 'PROTOCOL',
      vault: 'soEURC',
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  // Savings is unchanged: USDT into soUSD stays rhino.fi's, our own pipeline
  // carries it to the wallet and the card only.
  it('takes USDT through rhino.fi into soUSD', async () => {
    mount();
    act(() => flow().selectNetwork(polygon.id, 'USDT'));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'MATIC_POS', tokenSymbol: 'USDT', vault: 'soUSD' }),
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  // The list is where a loader, or a retry, says why there is no row yet.
  it('shows the list while its rows wait for rhino.fi', async () => {
    mockRhino.current = { status: 'loading', retry: jest.fn() };
    mount();
    act(() => flow().selectToken('EURC'));
    await settle();

    expect(mockStore.setModal).toHaveBeenLastCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_NETWORKS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('shows a "More networks" chain’s rhino.fi address, minting no session', async () => {
    mount();
    const selection = {
      chain: 'TRON',
      tokenSymbol: 'USDT',
      destinationType: 'PROTOCOL' as const,
      vault: 'soUSD',
    };
    act(() => flow().selectRhinoNetwork(selection));
    await settle();

    expect(mockStore.setRhinoDeposit).toHaveBeenLastCalledWith(selection);
    expect(mockStore.setDirectDepositSession).toHaveBeenLastCalledWith({
      selectedToken: 'USDT',
      chainId: undefined,
      walletAddress: undefined,
    });
    expect(mockStore.setModal).toHaveBeenLastCalledWith(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
