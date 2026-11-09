import React from 'react';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import DepositDirectlyNetworks from '@/components/DepositOption/DepositDirectlyNetworks';
import DepositDirectlyTokens from '@/components/DepositOption/DepositDirectlyTokens.web';
import { DEPOSIT_MODAL } from '@/constants/modals';
import {
  getDepositDirectlyTokens,
  resolveDepositDirectlyRow,
} from '@/hooks/useDepositDirectlyRhino';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { RhinoAssetsState } from '@/lib/rhinoDeposit';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The savings "Deposit directly" screens: rhino.fi's soUSD route on every chain
 * but Fuse, our own direct-deposit session on Fuse, and nothing else.
 */

jest.mock('@/components/DepositNetwork/DepositNetwork', () => 'DepositNetwork');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/errors', () => ({ showErrorToast: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: undefined }) }));
jest.mock('@/hooks/useDirectDepositSession', () => ({
  useDirectDepositSession: () => ({
    createDirectDepositSession: mockCreateSession,
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockStore),
}));

const mockCreateSession = jest.fn(async () => ({ sessionId: 's1', walletAddress: '0xabc' }));
const mockRetry = jest.fn();
const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: mockRetry,
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };
const mockStore = {
  directDepositSession: {} as Record<string, unknown>,
  setModal: jest.fn(),
  setDirectDepositSession: jest.fn(),
  clearDirectDepositSession: jest.fn(),
  setRhinoDeposit: jest.fn(),
};

let root: any;
const render = (element: React.ReactElement) => {
  act(() => {
    root = create(element);
  });
};
const networks = () => root.root.findAllByType('DepositNetwork');
const names = () => networks().map((node: any) => node.props.name);
const press = async (name: string) => {
  const node = networks().find((item: any) => item.props.name === name);
  await act(async () => {
    await node.props.onPress();
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockRhino.current = READY;
  mockStore.directDepositSession = {};
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('resolveDepositDirectlyRow', () => {
  const READY_STATE: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };

  it('is rhino.fi’s soUSD route off Fuse, USDT included, and ours on Fuse', () => {
    expect(resolveDepositDirectlyRow(READY_STATE, polygon.id, 'USDT')).toEqual({
      kind: 'rhino',
      selection: {
        chain: 'MATIC_POS',
        chainId: polygon.id,
        tokenSymbol: 'USDT',
        destinationType: 'PROTOCOL',
        vault: 'soUSD',
      },
    });
    expect(resolveDepositDirectlyRow(READY_STATE, fuse.id, 'USDC')).toEqual({ kind: 'own' });
    expect(resolveDepositDirectlyRow({ status: 'loading' }, mainnet.id, 'USDC')).toEqual({
      kind: 'loading',
    });
  });

  it('pairs each of a chain’s tokens with how it is served', () => {
    expect(
      getDepositDirectlyTokens(READY_STATE, base.id, ['USDC', 'USDT']).map(
        ({ state }) => state.kind,
      ),
    ).toEqual(['rhino', 'rhino']);
  });
});

describe('DepositDirectlyNetworks', () => {
  it('lists the chains with an address, rhino.fi’s marked, and Fuse our own', () => {
    render(<DepositDirectlyNetworks />);

    expect(names()).toEqual(['Ethereum', 'Polygon', 'Base', 'Arbitrum', 'BNB Chain', 'Fuse']);
    const descriptions = Object.fromEntries(
      networks().map((node: any) => [node.props.name, node.props.description]),
    );
    expect(descriptions.Base).toContain('via rhino.fi');
    expect(descriptions.Fuse).not.toContain('via rhino.fi');
  });

  // Base carries USDC alone, so there is no token step to take.
  it('shows the rhino.fi address for a one-token chain, minting no session', async () => {
    render(<DepositDirectlyNetworks />);
    await press('Base');

    expect(mockStore.setRhinoDeposit).toHaveBeenCalledWith({
      chain: 'BASE',
      chainId: base.id,
      tokenSymbol: 'USDC',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
    });
    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('goes to the token step for a chain with two, and mints nothing yet', async () => {
    render(<DepositDirectlyNetworks />);
    await press('Arbitrum');

    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('keeps our own session on Fuse', async () => {
    render(<DepositDirectlyNetworks />);
    await press('Fuse');

    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_TOKENS);
    expect(mockStore.setRhinoDeposit).not.toHaveBeenCalledWith(expect.anything());
  });

  it('offers only Fuse, with a loader or a retry, until rhino.fi’s routes are in', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    render(<DepositDirectlyNetworks />);
    expect(names()).toEqual(['Fuse']);
    expect(
      root.root.findAll((node: any) => node.props.accessibilityLabel === 'Loading networks').length,
    ).toBeGreaterThan(0);
    act(() => root.unmount());

    mockRhino.current = { status: 'unavailable', retry: mockRetry };
    render(<DepositDirectlyNetworks />);
    expect(names()).toEqual(['Fuse']);
    act(() => root.root.findByType('Button').props.onPress());
    expect(mockRetry).toHaveBeenCalled();
  });

  it('leaves out a chain rhino.fi has no soUSD route from', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BINANCE'),
      },
    };
    render(<DepositDirectlyNetworks />);
    expect(names()).not.toContain('BNB Chain');
    expect(names()).toContain('Arbitrum');
  });
});

describe('DepositDirectlyTokens', () => {
  it('shows rhino.fi’s address for a token off Fuse, minting no session', async () => {
    mockStore.directDepositSession = { chainId: arbitrum.id };
    render(<DepositDirectlyTokens />);
    expect(names()).toEqual(['USDC', 'USDT']);

    await press('USDT');
    expect(mockStore.setRhinoDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ chain: 'ARBITRUM', tokenSymbol: 'USDT', vault: 'soUSD' }),
    );
    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('mints our own session for a token on Fuse', async () => {
    mockStore.directDepositSession = { chainId: fuse.id };
    render(<DepositDirectlyTokens />);
    await press('USDC');

    expect(mockStore.setRhinoDeposit).toHaveBeenCalledWith(undefined);
    expect(mockCreateSession).toHaveBeenCalledWith(fuse.id, 'USDC');
    expect(mockStore.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
  });

  it('lists no token off Fuse until rhino.fi’s routes are in', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    mockStore.directDepositSession = { chainId: bsc.id };
    render(<DepositDirectlyTokens />);
    expect(names()).toEqual([]);
  });
});
