import React from 'react';
import { arbitrum, base, bsc } from 'viem/chains';

import WalletDepositTokens from '@/components/DepositOption/WalletDepositAddress/WalletDepositTokens';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { RHINO_ASSETS, RHINO_ASSETS_WITH_BITCOIN } from '@/lib/__tests__/rhinoFixtures';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/input', () => 'Input');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronRight: 'ChevronRight',
  Search: 'Search',
  X: 'X',
}));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: null }),
}));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: mockAccess.isEnabled, isLoading: false }),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockAccess = { isEnabled: true };
const mockRetry = jest.fn();
const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: mockRetry,
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };

const mockDeposit = {
  walletDeposit: {} as { chainId?: number; symbol?: string; isChangingToken?: boolean },
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};

const render = () => {
  let root: any;
  act(() => {
    root = create(<WalletDepositTokens />);
  });
  return root;
};

const texts = (root: any): string[] =>
  root.root.findAll((node: any) => node.type === 'Text').map((node: any) => node.props.children);

const search = (root: any, query: string) => {
  const input = root.root.findByType('Input');
  act(() => input.props.onChangeText(query));
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockDeposit.walletDeposit = {};
  mockAccess.isEnabled = true;
  mockRhino.current = READY;
});

describe('WalletDepositTokens', () => {
  it('lists every token with a row under its group, ticker over full name', () => {
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['Stablecoins', 'Crypto']));
    expect(shown).toEqual(
      expect.arrayContaining(['EURC', 'cbBTC', 'Coinbase Wrapped BTC', 'cbZEC']),
    );
    // Retired with the Base-only collateral list.
    expect(shown).not.toContain('Gold & silver');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('WBTC');
    expect(shown).not.toContain('OP');
    // A row each: USDC, USDT, EURC, ETH, FUSE, cbBTC, cbZEC, AAVE, SOL, WETH, WFUSE.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(11);
  });

  // Which tokens have a row is rhino.fi's to say off Fuse: no list until it has.
  it('waits for rhino.fi’s routes before listing anything', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    const root = render();

    expect(root.root.findAllByType('ChevronRight')).toHaveLength(0);
    expect(
      root.root.findAll((node: any) => node.props.accessibilityLabel === 'Loading tokens').length,
    ).toBeGreaterThan(0);
  });

  // Base and Fuse are our own, so they need nothing from rhino.fi.
  it('lists what Base and Fuse take, with a retry for the rest, when the routes cannot be had', () => {
    mockRhino.current = { status: 'unavailable', retry: mockRetry };
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['USDC', 'USDT', 'ETH', 'cbBTC', 'FUSE']));
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(11);
    expect(shown).toContain('Couldn’t load the other tokens.');

    act(() => root.root.findByType('Button').props.onPress());
    expect(mockRetry).toHaveBeenCalled();
  });

  // The backend answers `enabled: false` without a rhino.fi key: our own rows
  // are offered, the Safe on Base among them, and there is nothing to retry.
  it('lists what our own rows take, with no retry, while rhino.fi is off', () => {
    mockRhino.current = { status: 'disabled', retry: mockRetry };
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['USDC', 'USDT', 'ETH', 'cbBTC', 'FUSE']));
    expect(shown).not.toContain('BTC');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('Couldn’t load the other tokens.');
    expect(root.root.findAllByType('Button')).toHaveLength(0);

    // ETH has no row of ours but Base's, our wallet address there, which wraps it.
    const eth = root.root.find((node: any) => node.props.accessibilityLabel === 'ETH, Ether');
    act(() => eth.props.onPress());
    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'ETH', chainId: base.id }),
    );
  });

  it('lists only what everyone is offered for someone not given the new tokens', () => {
    mockAccess.isEnabled = false;
    const root = render();
    const shown = texts(root);

    expect(shown).not.toContain('Gold & silver');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('cbBTC');
    expect(shown).toEqual(expect.arrayContaining(['USDC', 'EURC', 'ETH', 'WFUSE']));
    // USDC, USDT, EURC, ETH, FUSE, WETH and WFUSE.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(7);
  });

  it('narrows the list to what matches the ticker or name', () => {
    const root = render();
    search(root, 'btc');

    const shown = texts(root);
    expect(shown).toEqual(expect.arrayContaining(['Crypto', 'cbBTC']));
    expect(shown).not.toContain('Stablecoins');
    expect(shown).not.toContain('USDC');
  });

  it('says so when nothing matches, and goes back to the full list from there', () => {
    const root = render();
    search(root, 'doge');

    expect(texts(root)).toContain('No matching token');

    const showAll = root.root.find((node: any) => node.props.accessibilityRole === 'link');
    act(() => showAll.props.onPress());

    expect(texts(root)).not.toContain('No matching token');
    expect(texts(root)).toContain('USDC');
  });

  it('opens the address on Base for a token rhino.fi takes nowhere, as the Safe', () => {
    const root = render();
    const cbBtc = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'cbBTC, Coinbase Wrapped BTC',
    );
    act(() => cbBtc.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'cbBTC',
      chainId: base.id,
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  const pressEth = (root: any) =>
    act(() =>
      root.root.find((node: any) => node.props.accessibilityLabel === 'ETH, Ether').props.onPress(),
    );

  it('keeps the chain already showing when rhino.fi takes the token there', () => {
    mockDeposit.walletDeposit = { chainId: bsc.id, symbol: 'USDC', isChangingToken: true };
    pressEth(render());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'ETH',
      chainId: bsc.id,
      rhinoChain: undefined,
      isChangingToken: false,
    });
  });

  it('moves off the chain showing when rhino.fi does not take the token there', () => {
    mockRhino.current = {
      ...READY,
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain =>
          chain.chain === 'ARBITRUM'
            ? { ...chain, tokens: chain.tokens.filter(token => token.symbol !== 'ETH') }
            : chain,
        ),
      },
    };
    mockDeposit.walletDeposit = { chainId: arbitrum.id, symbol: 'USDC', isChangingToken: true };
    pressEth(render());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'ETH',
      chainId: base.id,
      rhinoChain: undefined,
      isChangingToken: false,
    });
  });

  // Avalanche is no longer offered under "More networks": a screen still on it
  // (from before) leaves it for whichever token is picked next.
  it('leaves a "More networks" chain that is no longer offered when the token changes', () => {
    mockDeposit.walletDeposit = {
      chainId: base.id,
      symbol: 'ETH',
      rhinoChain: 'AVALANCHE',
      isChangingToken: true,
    } as any;
    const root = render();
    act(() =>
      root.root
        .find((node: any) => node.props.accessibilityLabel === 'USDC, USD Coin')
        .props.onPress(),
    );
    expect(mockDeposit.setWalletDeposit).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'USDC', rhinoChain: undefined }),
    );
  });

  // Native BTC has no row of the list's own: Bitcoin, under "More networks".
  it('opens native BTC on Bitcoin, once rhino.fi takes it there', () => {
    expect(texts(render())).not.toContain('BTC');

    mockRhino.current = { ...READY, assets: RHINO_ASSETS_WITH_BITCOIN };
    const root = render();
    expect(texts(root)).toEqual(expect.arrayContaining(['BTC', 'Bitcoin']));
    act(() =>
      root.root
        .find((node: any) => node.props.accessibilityLabel === 'BTC, Bitcoin')
        .props.onPress(),
    );

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'BTC',
      chainId: base.id,
      rhinoChain: 'BITCOIN',
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('ticks the current token only when coming back to change it', () => {
    expect(render().root.findAllByType('Check')).toHaveLength(0);

    mockDeposit.walletDeposit = { chainId: arbitrum.id, symbol: 'USDC', isChangingToken: true };
    expect(render().root.findAllByType('Check')).toHaveLength(1);
  });
});
