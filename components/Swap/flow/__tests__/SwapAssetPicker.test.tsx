import React from 'react';

import SwapAssetPicker from '@/components/Swap/flow/SwapAssetPicker';
import { SWAP_MODAL } from '@/constants/modals';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { HOME_SWAP_PRESET } from '@/lib/swapDefaults';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  Search: 'Search',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Swap/SwapAssetLogo', () => ({
  __esModule: true,
  default: 'SwapAssetLogo',
}));
jest.mock('@/constants/chains', () => ({
  CHAIN_NAMES: { 122: 'Fuse', 8453: 'Base' },
  CHAIN_ICONS: {},
}));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/swap/useSwapAssets', () => ({
  useSwapAssets: () => ({ assets: mockAssets, isLoading: mockAssetsLoading }),
}));
jest.mock('@/hooks/useAnalytics', () => ({
  useMaxAPY: () => ({ maxAPY: 4.8, isAPYsLoading: false }),
}));
jest.mock('@/store/swapStore', () => {
  const state = () => ({
    actions: { setModal: mockSetModal, selectCurrency: mockSelectCurrency },
    INPUT: mockPair.INPUT,
    OUTPUT: mockPair.OUTPUT,
  });
  const useSwapState = (selector: any) => selector(state());
  useSwapState.getState = state;
  return {
    useSwapActionHandlers: () => ({ onAssetSelection: mockAssetSelection }),
    useSwapState,
  };
});

const mockSetModal = jest.fn();
const mockSelectCurrency = jest.fn();
const mockAssetSelection = jest.fn();
let mockFrom: SwapAsset | undefined;
type Side = { currencyId: string | undefined; chainId: number };
let mockPair: { INPUT: Side; OUTPUT: Side };
const NO_PAIR = {
  INPUT: { currencyId: undefined, chainId: 122 },
  OUTPUT: { currencyId: undefined, chainId: 122 },
};

const coin = (symbol: string, chainId: number, address: SwapAsset['address'], balance: number) => ({
  chainId,
  address,
  symbol,
  name: symbol,
  decimals: 6,
  isNative: false,
  balance,
  balanceRaw: BigInt(Math.round(balance * 1e6)),
  balanceUsd: balance,
  priceUsd: 1,
  swappable: true,
});
const usdcFuse = coin('USDCe', 122, '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9', 30);
const usdcBase = coin('USDC', 8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 12.1);
const usdtFuse = coin('USDT', 122, '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7', 5);
const usdtBase = coin('USDT', 8453, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 1);
const usdYield = coin('soUSD', 122, PRODUCTION_VAULT_ADDRESSES.fuse.vault, 33.18);
let mockAssets = [usdcFuse, usdcBase, usdtFuse];
let mockAssetsLoading = false;
let mockReachable: ReadonlySet<string> | null | undefined = null;

let root: any;
const getPicker = () => (
  <SwapAssetPicker side="get" fromAsset={mockFrom} reachable={mockReachable} />
);
const mount = (side: 'pay' | 'get' = 'pay') =>
  act(() => {
    root = create(side === 'pay' ? <SwapAssetPicker side="pay" /> : getPicker());
  });
const words = (node: any): string => {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(words).join(' ');
  return words(node.children);
};
const text = () => words(root.toJSON());
const button = (label: string) =>
  root.root.findAll(
    (node: any) =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel?.startsWith(label),
  )[0];
const press = (label: string) => act(() => button(label).props.onPress());
const searchInput = () =>
  root.root.findAll(
    (node: any) =>
      node.props.accessibilityLabel === 'Search coins' &&
      typeof node.props.onChangeText === 'function',
  )[0];
const search = (query: string) => act(() => searchInput().props.onChangeText(query));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockAssets = [usdcFuse, usdcBase, usdtFuse];
  mockAssetsLoading = false;
  mockReachable = null;
  mockFrom = undefined;
  mockPair = NO_PAIR;
});
afterEach(() => act(() => root.unmount()));

it('asks which network to pay from for a coin held on more than one', () => {
  mount();
  expect(text()).toContain('42.10 USDC · 2 networks');
  press('USD Coin,');
  expect(mockAssetSelection).not.toHaveBeenCalled();
  expect(button('USD Coin,').props.accessibilityState.expanded).toBe(true);
  expect(button('USD Coin on Fuse, $30.00')).toBeDefined();
  expect(button('USD Coin on Base, $12.10')).toBeDefined();
  expect(text()).toContain('Tether');
  expect(searchInput()).toBeDefined();

  press('USD Coin on Base');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.INPUT, usdcBase);
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});

it('rounds the exact balance after combining networks with different decimals', () => {
  mockAssets = [
    { ...usdcFuse, balance: 1.005, balanceRaw: 1_005_000n },
    { ...usdcBase, balance: 1.01, balanceRaw: 1_010_000_000_000_000_000n, decimals: 18 },
  ];
  mount();

  expect(text()).toContain('2.02 USDC · 2 networks');
});

it('keeps one network row open and collapses it when tapped again', () => {
  mockAssets.push(usdtBase);
  mount();
  press('USD Coin,');
  press('Tether,');
  expect(button('USD Coin on Base')).toBeUndefined();
  expect(button('Tether on Base')).toBeDefined();
  press('Tether,');
  expect(button('Tether on Base')).toBeUndefined();
});

it('picks a coin held on one network straight away', () => {
  mount();
  press('Tether,');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.INPUT, usdtFuse);
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});

it('keeps a Fuse coin on "You get" when paying with a Base coin', () => {
  mockPair = {
    INPUT: { currencyId: usdcBase.address, chainId: 8453 },
    OUTPUT: { currencyId: usdtFuse.address, chainId: 122 },
  };
  mount();
  press('USD Coin,');
  press('USD Coin on Base');
  expect(mockSelectCurrency).not.toHaveBeenCalled();
});

it('clears "You get" when the network paid from can’t reach it', () => {
  mockPair = {
    INPUT: { currencyId: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161 },
    OUTPUT: { currencyId: usdtFuse.address, chainId: 122 },
  };
  mount();
  press('Tether,');
  expect(mockSelectCurrency).toHaveBeenCalledWith(SwapField.OUTPUT, undefined, 42161);
});

it('offers Fuse coins for a Base coin and selects a single-network result directly', () => {
  mockFrom = usdcBase;
  mount('get');
  expect(text()).toContain('USD Coin');
  press('Tether, USDT, Fuse');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.OUTPUT, usdtFuse);
});

it('offers Base coins for a Fuse coin, asking which network', () => {
  mockFrom = usdtFuse;
  mount('get');
  press('USD Coin,');
  expect(button('USD Coin on Fuse').props.accessibilityLabel).toBe('USD Coin on Fuse');
  expect(button('USD Coin on Base').props.accessibilityLabel).toBe('USD Coin on Base');
  press('USD Coin on Base');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.OUTPUT, usdcBase);
});

it('shows and selects the held USD Yield contract used by the Home swap preset', () => {
  mockAssets.push(usdYield);
  mockPair = {
    INPUT: {
      currencyId: HOME_SWAP_PRESET.input.address,
      chainId: HOME_SWAP_PRESET.input.chainId,
    },
    OUTPUT: { currencyId: usdcFuse.address, chainId: usdcFuse.chainId },
  };
  mount();
  expect(text()).toContain('33.18 soUSD');
  expect(text()).toContain('4.8% APY');
  expect(button('Earn')).toBeUndefined();
  press('USD Yield,');
  expect(mockAssetSelection).toHaveBeenCalledWith(
    SwapField.INPUT,
    expect.objectContaining(HOME_SWAP_PRESET.input),
  );
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});

it('filters You get by category and starts searches across categories', () => {
  mockAssets.push(usdYield);
  mount('get');
  press('Earn');
  expect(text()).toContain('USD Yield');
  expect(text()).not.toContain('USD Coin');
  search('teth');
  expect(text()).toContain('Tether');
  expect(text()).not.toContain('USD Yield');
  search('doge');
  expect(text()).toContain('No coins match “doge”');
});

it('waits for the first balance load before showing held coins', () => {
  mockAssetsLoading = true;
  mount();
  expect(searchInput()).toBeDefined();
  expect(button('USD Coin,')).toBeUndefined();

  mockAssetsLoading = false;
  act(() => root.update(<SwapAssetPicker side="pay" />));
  expect(button('USD Coin,')).toBeDefined();
});

it('waits for destination routes before showing selectable results on first open', () => {
  mockFrom = usdtFuse;
  mockReachable = undefined;
  mount('get');
  expect(searchInput()).toBeDefined();
  expect(button('USD Coin,')).toBeUndefined();

  mockReachable = new Set();
  act(() => root.update(getPicker()));
  expect(button('USD Coin, USDC, Fuse')).toBeDefined();
  expect(text()).not.toContain('2 networks');
});
