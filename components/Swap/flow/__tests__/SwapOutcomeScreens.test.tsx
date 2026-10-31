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
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 122: 'Fuse', 8453: 'Base' } }));
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
        openSwap: mockOpenSwap,
        setModal: jest.fn(),
        resetForm: jest.fn(),
        setReceipt: jest.fn(),
      },
    }),
}));

const mockOpenSwap = jest.fn();
let mockSend: any;
const USDC_FUSE = { chainId: 122, address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9' };
const WFUSE = { chainId: 122, address: '0x0BE9e53fd7EDaC9F859882AfdDa116645287C629' };
const mockReceipt = {
  kind: 'bridging',
  fromAmount: 5,
  fromName: 'USDC',
  toAmount: 200,
  toName: 'WFUSE',
  toAsset: { ...WFUSE, symbol: 'WFUSE', name: 'WFUSE', decimals: 18, isNative: false },
  feeUsd: 0.06,
  completedAt: Date.UTC(2026, 9, 31, 12),
  transactionHash: '0xabc',
  fromChainId: 8453,
  toChainId: 122,
  clientTxId: 'send-1',
  bridge: {
    sendId: 'send-1',
    sentDecimals: 6,
    thenSwap: { landsAs: USDC_FUSE, landsAsName: 'USDC', to: WFUSE },
  },
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
const buttons = () => root.root.findAllByType('Button');

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});
afterEach(() => act(() => root.unmount()));

it('follows the move to Fuse and says the swap comes once it lands', () => {
  mockSend = { status: 'sent', etaMinutes: 2, amountReceivedLD: '4940000' };
  mount();
  expect(text()).toContain('Moving USDC to Fuse');
  expect(steps().map((step: any) => [step.key, step.tone])).toEqual([
    ['sent', 'done'],
    ['moving', 'active'],
    ['arrived', 'pending'],
    ['swap', 'pending'],
  ]);
  expect(buttons()).toHaveLength(1);
});

it('offers the swap on Fuse for exactly what landed', () => {
  mockSend = { status: 'delivered', etaMinutes: 2, amountReceivedLD: '4940000' };
  mount();
  expect(text()).toContain('USDC is on Fuse');
  const [swapNow] = buttons();
  act(() => swapNow.props.onPress());
  expect(mockOpenSwap).toHaveBeenCalledWith({
    entryPoint: 'swap_arrival',
    input: USDC_FUSE,
    output: WFUSE,
    amount: '4.94',
  });
});
