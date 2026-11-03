import React from 'react';

import SwapAssetPicker from '@/components/Swap/flow/SwapAssetPicker';
import { SWAP_MODAL } from '@/constants/modals';
import { SwapField } from '@/lib/types/swap-field';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Search: 'Search',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Swap/SwapAssetLogo', () => ({
  __esModule: true,
  default: 'SwapAssetLogo',
}));
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 122: 'Fuse', 8453: 'Base' } }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/swap/useSwapFlow', () => ({ useSwapFlow: () => ({ fromAsset: mockFrom }) }));
jest.mock('@/hooks/swap/useSwapAssets', () => ({
  useSwapAssets: () => ({ assets: mockAssets, isLoading: false }),
}));
jest.mock('@/hooks/swap/useSwapDestinations', () => ({ useSwapDestinations: () => null }));
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
let mockFrom: any;
type Side = { currencyId: string | undefined; chainId: number };
let mockPair: { INPUT: Side; OUTPUT: Side };
const NO_PAIR = {
  INPUT: { currencyId: undefined, chainId: 122 },
  OUTPUT: { currencyId: undefined, chainId: 122 },
};

const coin = (symbol: string, chainId: number, address: string, balance: number) => ({
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
let mockAssets = [usdcFuse, usdcBase, usdtFuse];

let root: any;
const mount = (side: 'pay' | 'get' = 'pay') =>
  act(() => {
    root = create(<SwapAssetPicker side={side} />);
  });
const words = (node: any): string => {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(words).join(' ');
  return words(node.children);
};
const text = () => words(root.toJSON());
const press = (label: string) =>
  act(() =>
    root.root
      .find(
        (node: any) =>
          typeof node.props.onPress === 'function' &&
          node.props.accessibilityLabel?.startsWith(label),
      )
      .props.onPress(),
  );

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockAssets = [usdcFuse, usdcBase, usdtFuse];
  mockFrom = undefined;
  mockPair = NO_PAIR;
});
afterEach(() => act(() => root.unmount()));

it('asks which network to pay from for a coin held on more than one', () => {
  mount();
  expect(text()).toContain('On 2 networks');
  press('USDC,');
  expect(mockAssetSelection).not.toHaveBeenCalled();
  expect(text()).toContain('Pay with USDC from');
  expect(text()).toContain('Fuse');
  expect(text()).toContain('Base');
  expect(text()).toContain('12.1');

  press('USDC on Base');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.INPUT, usdcBase);
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});

it('goes back to every coin from the network step', () => {
  mount();
  press('USDC,');
  press('Back to all coins');
  expect(text()).toContain('On 2 networks');
  expect(text()).not.toContain('Pay with USDC from');
});

it('picks a coin held on one network straight away', () => {
  mount();
  press('USDT,');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.INPUT, usdtFuse);
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});

it('keeps a Fuse coin on "You get" when paying with a Base coin', () => {
  mockPair = {
    INPUT: { currencyId: usdcBase.address, chainId: 8453 },
    OUTPUT: { currencyId: usdtFuse.address, chainId: 122 },
  };
  mount();
  press('USDC,');
  press('USDC on Base');
  expect(mockSelectCurrency).not.toHaveBeenCalled();
});

it('clears "You get" when the network paid from can’t reach it', () => {
  mockPair = {
    INPUT: { currencyId: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161 },
    OUTPUT: { currencyId: usdtFuse.address, chainId: 122 },
  };
  mount();
  press('USDT,');
  expect(mockSelectCurrency).toHaveBeenCalledWith(SwapField.OUTPUT, undefined, 42161);
});

it('offers Fuse coins for a Base coin, arriving on Fuse', () => {
  mockFrom = usdcBase;
  mount('get');
  expect(text()).toContain('Dollar coin · card and Send use it · arrives on Fuse');
  press('USDT,');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.OUTPUT, usdtFuse);
});

it('offers Base coins for a Fuse coin, asking which network', () => {
  mockFrom = usdtFuse;
  mount('get');
  press('USDC,');
  expect(text()).toContain('Get USDC on');
  expect(text()).toContain('Same network, straight away');
  expect(text()).toContain('Arrives on Base in a few minutes');
  press('USDC on Base');
  expect(mockAssetSelection).toHaveBeenCalledWith(SwapField.OUTPUT, usdcBase);
});
