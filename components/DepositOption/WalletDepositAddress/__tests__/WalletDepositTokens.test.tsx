import React from 'react';
import { arbitrum, base, optimism } from 'viem/chains';

import WalletDepositTokens from '@/components/DepositOption/WalletDepositAddress/WalletDepositTokens';
import { DEPOSIT_MODAL } from '@/constants/modals';

import type { RhinoDepositAssetsResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/input', () => 'Input');
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
jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  isDevFeatureEnabled: true,
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: null }),
}));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: mockAccess.isEnabled, isLoading: false }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));
// rhino.fi's chains as /deposit/rhino/assets would offer them, when offered at all.
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.assets,
}));

const mockAccess = { isEnabled: true };

const mockRhino: { assets: RhinoDepositAssetsResponse | undefined } = { assets: undefined };

const mockDeposit = {
  walletDeposit: {} as {
    chainId?: number;
    symbol?: string;
    rhinoChain?: string;
    isChangingToken?: boolean;
  },
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};

const walletRoute = (symbol: string) => ({
  destinationType: 'WALLET' as const,
  receiveSymbol: symbol,
  receiveChainId: base.id,
  minimumUsd: 5,
  maximumUsd: 100000,
});

const TRON_ASSETS: RhinoDepositAssetsResponse = {
  enabled: true,
  chains: [
    {
      chain: 'TRON',
      name: 'Tron',
      addressType: 'TRON',
      tokens: [
        {
          symbol: 'USDT',
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          routes: [walletRoute('USDT')],
        },
        {
          symbol: 'USDC',
          address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
          routes: [walletRoute('USDC')],
        },
      ],
    },
  ],
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
  mockRhino.assets = undefined;
});

describe('WalletDepositTokens', () => {
  it('lists every token under its group, ticker over full name', () => {
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['Stablecoins', 'Gold & silver', 'Crypto']));
    expect(shown).toEqual(
      expect.arrayContaining(['PAXG', 'Gold', 'cbBTC', 'Coinbase Wrapped BTC']),
    );
    expect(shown).not.toContain('EURC');
    // A row each: 19 tokens, EURC being a Wirex cardholder's alone.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(19);
  });

  it('lists only what everyone is offered for someone not given the new tokens', () => {
    mockAccess.isEnabled = false;
    const root = render();
    const shown = texts(root);

    expect(shown).not.toContain('Gold & silver');
    expect(shown).not.toContain('PAXG');
    expect(shown).toEqual(expect.arrayContaining(['USDC', 'ETH', 'WFUSE']));
    // USDC, USDT, ETH, FUSE, WETH and WFUSE.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(6);
  });

  it('narrows the list to what matches the ticker or name', () => {
    const root = render();
    search(root, 'btc');

    const shown = texts(root);
    expect(shown).toEqual(expect.arrayContaining(['Crypto', 'WBTC', 'cbBTC']));
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

  it('opens the address on the token’s home chain once picked', () => {
    const root = render();
    const op = root.root.find((node: any) => node.props.accessibilityLabel === 'OP, Optimism');
    act(() => op.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'OP',
      chainId: optimism.id,
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('keeps the chain already showing when it carries the token', () => {
    mockDeposit.walletDeposit = { chainId: arbitrum.id, symbol: 'USDC', isChangingToken: true };
    const root = render();
    const wbtc = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'WBTC, Wrapped Bitcoin',
    );
    act(() => wbtc.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'WBTC',
      chainId: arbitrum.id,
      isChangingToken: false,
    });
  });

  it('keeps a rhino.fi chain that takes the new token into the wallet', () => {
    mockRhino.assets = TRON_ASSETS;
    mockDeposit.walletDeposit = {
      chainId: base.id,
      symbol: 'USDT',
      rhinoChain: 'TRON',
      isChangingToken: true,
    };
    const root = render();
    const usdc = root.root.find((node: any) => node.props.accessibilityLabel === 'USDC, USD Coin');
    act(() => usdc.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'USDC', rhinoChain: 'TRON' }),
    );
  });

  it('leaves a rhino.fi chain that does not take the new token', () => {
    mockRhino.assets = TRON_ASSETS;
    mockDeposit.walletDeposit = {
      chainId: base.id,
      symbol: 'USDT',
      rhinoChain: 'TRON',
      isChangingToken: true,
    };
    const root = render();
    // Tron only takes USDT and USDC here; EURC is a Wirex cardholder's alone on this branch.
    const wbtc = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'WBTC, Wrapped Bitcoin',
    );
    act(() => wbtc.props.onPress());

    const [selection] = mockDeposit.setWalletDeposit.mock.calls[0];
    expect(selection).toMatchObject({ symbol: 'WBTC' });
    expect(selection.rhinoChain).toBeUndefined();
  });

  it('ticks the current token only when coming back to change it', () => {
    expect(render().root.findAllByType('Check')).toHaveLength(0);

    mockDeposit.walletDeposit = { chainId: arbitrum.id, symbol: 'USDC', isChangingToken: true };
    expect(render().root.findAllByType('Check')).toHaveLength(1);
  });
});
