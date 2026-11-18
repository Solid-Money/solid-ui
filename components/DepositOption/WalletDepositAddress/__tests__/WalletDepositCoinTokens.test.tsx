import React from 'react';
import { arbitrum, base, bsc } from 'viem/chains';

import WalletDepositCoinTokens from '@/components/DepositOption/WalletDepositAddress/WalletDepositCoinTokens';
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
  useDepositTokensAccess: () => ({ isEnabled: true, isLoading: false }),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockRetry = jest.fn();
const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: mockRetry,
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };

const mockDeposit = {
  walletDeposit: {} as {
    chainId?: number;
    symbol?: string;
    rhinoChain?: string;
    isChangingToken?: boolean;
    coin?: string;
  },
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};

const render = () => {
  let root: any;
  act(() => {
    root = create(<WalletDepositCoinTokens />);
  });
  return root;
};

const texts = (root: any): string[] =>
  root.root.findAll((node: any) => node.type === 'Text').map((node: any) => node.props.children);

const press = (root: any, label: string) =>
  act(() => root.root.find((node: any) => node.props.accessibilityLabel === label).props.onPress());

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockDeposit.walletDeposit = { coin: 'bitcoin' };
  mockRhino.current = READY;
});

describe('WalletDepositCoinTokens', () => {
  it('lists the coin’s tokens, ticker over full name', () => {
    const shown = texts(render());

    expect(shown).toEqual([
      'Pick the one you’re sending',
      'WBTC',
      'Wrapped Bitcoin',
      'cbBTC',
      'Coinbase Wrapped BTC',
    ]);
  });

  // Native BTC has no row of the list's own: Bitcoin, under "More networks".
  it('lists native BTC first, once rhino.fi takes it on Bitcoin, and opens it there', () => {
    mockRhino.current = { ...READY, assets: RHINO_ASSETS_WITH_BITCOIN };
    const root = render();
    expect(texts(root).filter((_, index) => index % 2 === 1)).toEqual(['BTC', 'WBTC', 'cbBTC']);

    press(root, 'BTC, Bitcoin');
    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'BTC',
      chainId: base.id,
      rhinoChain: 'BITCOIN',
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('opens the address on Base for a token rhino.fi takes nowhere, as the Safe', () => {
    press(render(), 'cbBTC, Coinbase Wrapped BTC');

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'cbBTC',
      chainId: base.id,
      rhinoChain: undefined,
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('keeps the chain already showing when rhino.fi takes the token there', () => {
    mockDeposit.walletDeposit = {
      coin: 'ether',
      chainId: bsc.id,
      symbol: 'USDC',
      isChangingToken: true,
    };
    press(render(), 'ETH, Ether');

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
    mockDeposit.walletDeposit = {
      coin: 'ether',
      chainId: arbitrum.id,
      symbol: 'USDC',
      isChangingToken: true,
    };
    press(render(), 'ETH, Ether');

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'ETH',
      chainId: base.id,
      rhinoChain: undefined,
      isChangingToken: false,
    });
  });

  // Avalanche takes ETH and WBTC into the wallet; it takes no WETH.
  it('keeps a "More networks" chain that takes the new token, and leaves one that does not', () => {
    mockDeposit.walletDeposit = {
      coin: 'bitcoin',
      chainId: base.id,
      symbol: 'ETH',
      rhinoChain: 'AVALANCHE',
      isChangingToken: true,
    };
    press(render(), 'WBTC, Wrapped Bitcoin');
    expect(mockDeposit.setWalletDeposit).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'WBTC', rhinoChain: 'AVALANCHE' }),
    );

    mockDeposit.walletDeposit = { ...mockDeposit.walletDeposit, coin: 'ether' };
    press(render(), 'WETH, Wrapped Ether');
    expect(mockDeposit.setWalletDeposit).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'WETH', rhinoChain: undefined }),
    );
  });

  // Opened from the address's pill before the routes are in.
  it('waits for rhino.fi’s routes before listing anything', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    const root = render();

    expect(root.root.findAllByType('ChevronRight')).toHaveLength(0);
    expect(texts(root)).not.toContain('Pick the one you’re sending');
    expect(
      root.root.findAll((node: any) => node.props.accessibilityLabel === 'Loading tokens').length,
    ).toBeGreaterThan(0);
  });

  // ETH has no row of ours but Base's, our wallet address there, which wraps it.
  it('opens ETH on Base while rhino.fi is off', () => {
    mockRhino.current = { status: 'disabled', retry: mockRetry };
    mockDeposit.walletDeposit = { coin: 'ether' };
    press(render(), 'ETH, Ether');

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'ETH', chainId: base.id }),
    );
  });

  it('ticks the token showing only when coming back to change it', () => {
    mockDeposit.walletDeposit = { coin: 'bitcoin', symbol: 'cbBTC' };
    expect(render().root.findAllByType('Check')).toHaveLength(0);

    mockDeposit.walletDeposit = { coin: 'bitcoin', symbol: 'cbBTC', isChangingToken: true };
    const root = render();
    expect(root.root.findAllByType('Check')).toHaveLength(1);
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(1);
  });
});
