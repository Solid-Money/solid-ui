import React from 'react';

import SwapFormScreen from '@/components/Swap/flow/SwapFormScreen';
import { SWAP_MODAL } from '@/constants/modals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({
  ArrowUpDown: 'ArrowUpDown',
  ChevronDown: 'ChevronDown',
  CircleAlert: 'CircleAlert',
  Wallet: 'Wallet',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/Swap/SwapAssetLogo', () => ({
  __esModule: true,
  default: 'SwapAssetLogo',
}));
jest.mock('@/components/Send/CrossChain/shared', () => ({
  MaxPill: 'MaxPill',
  DetailCard: 'DetailCard',
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api/lifi-swap', () => ({ LifiSwapApiError: class extends Error {} }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/swap/useSwapFlow', () => ({ useSwapFlow: () => mockModel }));
jest.mock('@/store/swapStore', () => ({
  useSwapActionHandlers: () => ({ onSwitchTokens: jest.fn(), onUserInput: mockUserInput }),
  useSwapState: (selector: any) => selector({ actions: { setModal: mockSetModal } }),
}));

const mockSetModal = jest.fn();
const mockUserInput = jest.fn();
const USD_YIELD = {
  chainId: 122,
  address: '0x75333830e7014e909535389a6e5b0c02aa62ca27',
  symbol: 'soUSD',
  name: 'Solid USD',
  decimals: 6,
  isNative: false,
  balance: 18.43,
  balanceRaw: 18_430_000n,
  balanceUsd: 19.94,
  priceUsd: 1.082,
  swappable: true,
};
const USDC = { ...USD_YIELD, address: '0xc6bc', symbol: 'USDCe', balance: 42.1, priceUsd: 1 };

let mockModel: any;
const model = (overrides: Record<string, unknown> = {}) => ({
  route: 'fuse',
  isLegacyPair: false,
  fromAsset: USD_YIELD,
  toAsset: USDC,
  fromBalance: 18_430_000n,
  maxValue: '18.43',
  typedValue: '18.43',
  toAmount: 19.84,
  fromUsd: 19.94,
  toUsd: 19.84,
  rate: 1.0765,
  feeUsd: 0.1,
  feePercentage: 0.005,
  feeFootnote: 'Core plan fee. Prime pays 0.25%, Ultra pays nothing.',
  etaSeconds: 0,
  isCrossChain: false,
  isQuoting: false,
  error: undefined,
  canReview: true,
  isSending: false,
  recheck: jest.fn(),
  execute: jest.fn(),
  ...overrides,
});

let root: any;
const mount = () =>
  act(() => {
    root = create(<SwapFormScreen />);
  });
const button = () => root.root.findByType('Button');
/** The words on screen, without props (bigint balances, rows holding elements). */
const words = (node: any): string => {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(words).join(' ');
  return words(node.children);
};
const text = () => words(root.toJSON());

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});
afterEach(() => act(() => root.unmount()));

it('prices the swap and offers Review (01)', () => {
  mockModel = model();
  mount();
  expect(text()).toContain('USD Yield');
  expect(text()).toContain('19.84');
  expect(text()).toContain('$19.94');
  expect(text()).toContain('Core plan fee');
  const rows = root.root.findByType('DetailCard').props.rows;
  expect(rows.map((row: any) => row.label)).toEqual(['Rate', 'Fee', 'Network fee', 'Arrives']);
  expect(rows.find((row: any) => row.key === 'fee').value).toBe('$0.10 (0.5%)');
  expect(rows.find((row: any) => row.key === 'arrives').value).toBe('Instantly');
  expect(button().props.disabled).toBe(false);
  act(() => button().props.onPress());
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_REVIEW);
});

it('says it is getting a price and holds the button (07)', () => {
  mockModel = model({ isQuoting: true, toAmount: undefined, canReview: false });
  mount();
  expect(text()).toContain('Getting price…');
  expect(button().props.disabled).toBe(true);
});

it('shows a short balance in red under the amount (08)', () => {
  mockModel = model({
    typedValue: '50',
    canReview: false,
    error: { code: 'NOT_ENOUGH_BALANCE', copy: 'You don’t have enough USD Yield.' },
  });
  mount();
  expect(text()).toContain('You have 18.43 USD Yield');
  expect(text()).toContain('Not enough USD Yield');
  expect(button().props.disabled).toBe(true);
});

it('explains a missing route and lets the button pick another coin (09)', () => {
  mockModel = model({
    toAmount: undefined,
    canReview: false,
    error: { code: 'NO_ROUTE', copy: 'We can’t swap FUSE to EURC right now.' },
  });
  mount();
  expect(text()).toContain('We can’t swap FUSE to EURC right now.');
  expect(text()).toContain('—');
  expect(button().props.disabled).toBe(false);
  act(() => button().props.onPress());
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_GET_PICKER);
});

it('keeps only what can be typed into an amount', () => {
  mockModel = model({ typedValue: '' });
  mount();
  const input = root.root.find((node: any) => node.props.keyboardType === 'decimal-pad');
  act(() => input.props.onChangeText('1,5x'));
  expect(mockUserInput).toHaveBeenCalledWith('INPUT', '1.5');
});
