import React from 'react';

import { SwapOnItsWayScreen } from '@/components/Swap/flow/SwapOutcomeScreens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ ArrowUpRight: 'ArrowUpRight', Check: 'Check' }));
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
jest.mock('@/store/lifiSwapStore', () => ({ useLifiSwapStore: () => undefined }));
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

it('shows why a send failed', () => {
  mockSend = { status: 'failed', failureReason: 'Stargate refunded the send.' };
  mount();
  expect(steps()[1]).toMatchObject({ tone: 'failed', subtitle: 'Stargate refunded the send.' });
});
