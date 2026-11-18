import React from 'react';
import { base } from 'viem/chains';

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
  walletDeposit: {} as {
    chainId?: number;
    symbol?: string;
    isChangingToken?: boolean;
    coin?: string;
  },
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

const press = (root: any, label: string) =>
  act(() => root.root.find((node: any) => node.props.accessibilityLabel === label).props.onPress());

describe('WalletDepositTokens', () => {
  it('lists a row per token, and one per coin over the tokens it comes as', () => {
    const root = render();
    const shown = texts(root);

    expect(shown).toEqual(expect.arrayContaining(['Stablecoins', 'Crypto']));
    expect(shown).toEqual(
      expect.arrayContaining([
        'EURC',
        'Euro Coin',
        'Ether',
        'ETH · WETH',
        'Bitcoin',
        'WBTC · cbBTC',
        'Fuse',
        'FUSE · WFUSE',
        'cbZEC',
      ]),
    );
    // A coin's tokens are on its own screen, not here.
    ['ETH', 'WETH', 'WBTC', 'cbBTC', 'WFUSE'].forEach(ticker =>
      expect(shown).not.toContain(ticker),
    );
    // Retired with the Base-only collateral list.
    expect(shown).not.toContain('Gold & silver');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('OP');
    // A row each: USDC, USDT, EURC, Ether, Bitcoin, Fuse, cbZEC, AAVE, SOL.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(9);
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

    // WBTC included: Base is the Safe.
    expect(shown).toEqual(
      expect.arrayContaining(['USDC', 'USDT', 'Ether', 'Bitcoin', 'WBTC · cbBTC', 'Fuse']),
    );
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(9);
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

    // ETH has no row of ours but Base's, our wallet address there, which wraps it.
    expect(shown).toEqual(
      expect.arrayContaining(['USDC', 'USDT', 'Ether', 'ETH · WETH', 'Bitcoin', 'Fuse']),
    );
    expect(shown).not.toContain('BTC · WBTC · cbBTC');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('Couldn’t load the other tokens.');
    expect(root.root.findAllByType('Button')).toHaveLength(0);
  });

  // cbBTC is not everyone's yet, so WBTC is their only Bitcoin: listed as itself.
  it('lists only what everyone is offered for someone not given the new tokens', () => {
    mockAccess.isEnabled = false;
    const root = render();
    const shown = texts(root);

    expect(shown).not.toContain('Gold & silver');
    expect(shown).not.toContain('PAXG');
    expect(shown).not.toContain('cbBTC');
    expect(shown).not.toContain('Bitcoin');
    expect(shown).toEqual(
      expect.arrayContaining(['USDC', 'EURC', 'Ether', 'WBTC', 'Wrapped Bitcoin', 'Fuse']),
    );
    // USDC, USDT, EURC, Ether, WBTC and Fuse.
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(6);

    press(root, 'WBTC, Wrapped Bitcoin');
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('finds a coin by any of its tokens', () => {
    const root = render();
    search(root, 'btc');

    const shown = texts(root);
    expect(shown).toEqual(expect.arrayContaining(['Crypto', 'Bitcoin', 'WBTC · cbBTC']));
    expect(shown).not.toContain('Stablecoins');
    expect(shown).not.toContain('USDC');
    expect(root.root.findAllByType('ChevronRight')).toHaveLength(1);

    search(root, 'weth');
    expect(texts(root)).toEqual(expect.arrayContaining(['Ether', 'ETH · WETH']));
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

  it('opens a coin’s own screen from its row', () => {
    press(render(), 'Bitcoin, WBTC · cbBTC');

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ coin: 'bitcoin' });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_COIN);
  });

  it('opens the address on Base for a token rhino.fi takes nowhere, as the Safe', () => {
    press(render(), 'AAVE, Aave');

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      symbol: 'AAVE',
      chainId: base.id,
      rhinoChain: undefined,
      isChangingToken: false,
    });
    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  // Native BTC has no row of the list's own: Bitcoin, under "More networks".
  it('lists native BTC under Bitcoin, once rhino.fi takes it there', () => {
    expect(texts(render())).toContain('WBTC · cbBTC');

    mockRhino.current = { ...READY, assets: RHINO_ASSETS_WITH_BITCOIN };
    expect(texts(render())).toContain('BTC · WBTC · cbBTC');
  });

  it('ticks the current token only when coming back to change it', () => {
    expect(render().root.findAllByType('Check')).toHaveLength(0);

    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDC', isChangingToken: true };
    expect(render().root.findAllByType('Check')).toHaveLength(1);
  });

  it('ticks the coin of the token showing', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'cbBTC', isChangingToken: true };
    const root = render();

    const ticked = root.root.findAll(
      (node: any) =>
        node.props.accessibilityRole === 'button' &&
        node.findAllByType('Check').length > 0 &&
        node.props.accessibilityLabel,
    );
    // The pressable and the view it renders carry the same label.
    expect(new Set(ticked.map((node: any) => node.props.accessibilityLabel))).toEqual(
      new Set(['Bitcoin, WBTC · cbBTC']),
    );
  });
});
