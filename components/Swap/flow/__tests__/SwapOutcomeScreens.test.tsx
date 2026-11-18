import React from 'react';

import { SwapOnItsWayScreen } from '@/components/Swap/flow/SwapOutcomeScreens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ ArrowUpRight: 'ArrowUpRight', Check: 'Check', X: 'X' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/Send/CrossChain/shared', () => ({
  BRAND: '#94f27f',
  DetailCard: 'DetailCard',
  StepTracker: 'StepTracker',
}));
jest.mock('@/components/Swap/flow/sendReceived', () => ({ openSendWithReceived: jest.fn() }));
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 1: 'Ethereum', 122: 'Fuse' } }));
jest.mock('@/lib/api/cross-chain-send', () => ({ fetchCrossChainSend: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/wagmi', () => ({ getChain: () => undefined }));
jest.mock('@/store/lifiSwapStore', () => ({
  useLifiSwapStore: (selector: any) => selector({ swaps: { 'send-1': mockTracked } }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockSend }) }));
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: any) =>
    selector({
      receipt: mockReceipt,
      actions: {
        setModal: jest.fn(),
        resetForm: jest.fn(),
        setReceipt: jest.fn(),
      },
    }),
}));

let mockSend: any;
let mockTracked: any;
const USDC_FUSE = { chainId: 122, address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9' };
const mockReceipt = {
  kind: 'bridging',
  fromAmount: 10,
  fromName: 'USDC',
  toAmount: 10,
  toName: 'USDC',
  toAsset: { ...USDC_FUSE, symbol: 'USDC', name: 'USDC', decimals: 6, isNative: false },
  feeUsd: 0.06,
  completedAt: Date.UTC(2026, 10, 1, 12),
  transactionHash: '0xabc',
  fromChainId: 1,
  toChainId: 122,
  clientTxId: 'send-1',
  bridge: { sendId: 'send-1', sentDecimals: 6 },
};

let root: any;
const mount = () =>
  act(() => {
    root = create(<SwapOnItsWayScreen />);
  });
const words = (node: any): string => {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(words).join(' ');
  return words(node.children);
};
const text = () => words(root.toJSON());
const steps = () => root.root.findByType('StepTracker').props.steps;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockTracked = undefined;
});
afterEach(() => act(() => root.unmount()));

it('follows USDC over Solid’s bridge from Ethereum to Fuse', () => {
  mockSend = { status: 'sent', etaMinutes: 5 };
  mount();
  expect(text()).toContain('Swap on its way');
  expect(text()).toContain('10 USDC → 10 USDC on Fuse');
  expect(steps().map((step: any) => [step.key, step.tone, step.title])).toEqual([
    ['sent', 'done', 'Sent from Ethereum'],
    ['moving', 'active', 'Moving USDC to Fuse'],
    ['arrived', 'pending', 'Arrived on Fuse'],
  ]);
  expect(steps()[1].subtitle).toBe('About 5 min');
});

it('shows Swapped with what landed once the send is delivered', () => {
  mockSend = { status: 'delivered', etaMinutes: 5, amountReceivedLD: '9990000' };
  mount();
  expect(text()).toContain('Swapped');
  expect(text().replace(/\s+/g, ' ')).toContain('9.99 USDC is in your wallet');
  const rows = root.root.findByType('DetailCard').props.rows;
  expect(rows.find((row: any) => row.key === 'got').value).toBe('9.99 USDC');
});

it('shows why a send failed, and stops saying it is on its way', () => {
  mockSend = { status: 'failed', failureReason: 'Stargate refunded the send.' };
  mount();
  expect(steps()[1]).toMatchObject({ tone: 'failed', subtitle: 'Stargate refunded the send.' });
  expect(text()).toContain('Swap didn’t go through');
  expect(text()).not.toContain('Swap on its way');
  expect(text()).not.toContain('We’ll let you know when it arrives');
  expect(root.root.findAllByType('X')).toHaveLength(1);
});

it('falls back on the quoted amount when the delivered amount is unreadable', () => {
  mockSend = { status: 'delivered', etaMinutes: 5, amountReceivedLD: 'n/a' };
  mount();
  expect(text().replace(/\s+/g, ' ')).toContain('10 USDC is in your wallet');
});

it('says a LI.FI swap didn’t go through when LI.FI reports it failed', () => {
  const { bridge } = mockReceipt;
  delete (mockReceipt as any).bridge;
  try {
    mockTracked = { status: 'FAILED' };
    mount();
    expect(steps()[1]).toMatchObject({ key: 'converting', tone: 'failed' });
    expect(text()).toContain('Swap didn’t go through');
    expect(text()).not.toContain('We’ll let you know when it arrives');
  } finally {
    (mockReceipt as any).bridge = bridge;
  }
});
