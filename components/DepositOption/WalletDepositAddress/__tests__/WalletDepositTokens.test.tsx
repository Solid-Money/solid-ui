import React from 'react';
import { base, fuse } from 'viem/chains';

import WalletDepositTokens from '@/components/DepositOption/WalletDepositAddress/WalletDepositTokens';
import { DEPOSIT_MODAL } from '@/constants/modals';

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
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: null }),
}));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: mockAccess.isEnabled, isLoading: false }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockAccess = { isEnabled: true };

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
});

describe('WalletDepositTokens', () => {
  it('lists every token under its group, ticker over full name', () => {
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['Stablecoins', 'Crypto']));
    expect(shown).toEqual(
      expect.arrayContaining(['cbZEC', 'Coinbase Wrapped ZEC', 'cbBTC', 'Coinbase Wrapped BTC']),
    );
    expect(shown).not.toContain('EURC');
    // A row each: 7 tokens, EURC being a Wirex cardholder's alone.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(7);
  });

  it('lists only what everyone is offered for someone not given the new tokens', () => {
    mockAccess.isEnabled = false;
    const root = render();
    const shown = texts(root);

    expect(shown).not.toContain('cbBTC');
    expect(shown).not.toContain('cbZEC');
    expect(shown).toEqual(expect.arrayContaining(['USDC', 'USDT', 'WETH']));
    // USDC, USDT and WETH.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(3);
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

  it('opens the address on Base once a token is picked', () => {
    const root = render();
    const cbzec = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'cbZEC, Coinbase Wrapped ZEC',
    );
    act(() => cbzec.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'cbZEC',
      chainId: base.id,
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('keeps the chain already showing when it carries the token', () => {
    mockDeposit.walletDeposit = { chainId: fuse.id, symbol: 'USDC', isChangingToken: true };
    const root = render();
    const usdt = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'USDT, Tether USD',
    );
    act(() => usdt.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'USDT',
      chainId: fuse.id,
      isChangingToken: false,
    });
  });

  it('moves to Base for a token the chain showing does not carry', () => {
    mockDeposit.walletDeposit = { chainId: fuse.id, symbol: 'USDC', isChangingToken: true };
    const root = render();
    const cbbtc = root.root.find(
      (node: any) => node.props.accessibilityLabel === 'cbBTC, Coinbase Wrapped BTC',
    );
    act(() => cbbtc.props.onPress());

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'cbBTC',
      chainId: base.id,
      isChangingToken: false,
    });
  });

  it('ticks the current token only when coming back to change it', () => {
    expect(render().root.findAllByType('Check')).toHaveLength(0);

    mockDeposit.walletDeposit = { chainId: fuse.id, symbol: 'USDC', isChangingToken: true };
    expect(render().root.findAllByType('Check')).toHaveLength(1);
  });
});
