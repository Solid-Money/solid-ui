import React from 'react';

import SwapReviewScreen from '@/components/Swap/flow/SwapReviewScreen';
import { SWAP_MODAL } from '@/constants/modals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ RefreshCw: 'RefreshCw' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/Swap/SwapAssetLogo', () => ({
  __esModule: true,
  default: 'SwapAssetLogo',
}));
jest.mock('@/components/Send/CrossChain/shared', () => ({ DetailCard: 'DetailCard' }));
jest.mock('@/components/Swap/flow/SwapDetailsCard', () => ({ swapDetailRows: () => [] }));
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 122: 'Fuse' } }));
jest.mock('@/lib/assets', () => ({ getAsset: () => 1 }));
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/lib/api/lifi-swap', () => ({ LifiSwapApiError: class extends Error {} }));
jest.mock('@/lib/errors', () => ({
  sanitizeTechnicalMessage: jest.requireActual('@/lib/errors/sanitize').sanitizeTechnicalMessage,
  showFailureSheet: (...args: unknown[]) => mockFailureSheet(...args),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'a' } }),
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  selectedRewardsUserId: () => 'a',
  useRewardsUpgradeStore: { getState: () => ({ session: 0 }) },
}));
jest.mock('@/hooks/swap/useSwapFlow', () => {
  class SwapFlowStop extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { SwapFlowStop, useSwapFlow: () => mockModel };
});
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: any) =>
    selector({ actions: { setModal: mockSetModal, setReceipt: mockSetReceipt } }),
}));

const mockTrack = jest.fn();
const mockFailureSheet = jest.fn();
const mockSetModal = jest.fn();
const mockSetReceipt = jest.fn();
const mockExecute = jest.fn();
const ASSET = { chainId: 122, address: '0x1', symbol: 'soUSD', name: 'Solid USD', decimals: 6 };
let mockModel: any;

let root: any;
const mount = () =>
  act(() => {
    root = create(<SwapReviewScreen />);
  });
const swap = () => act(async () => root.root.findByType('Button').props.onPress());
const text = () => JSON.stringify(root.toJSON());

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockModel = {
    route: 'fuse',
    fromAsset: ASSET,
    toAsset: { ...ASSET, address: '0x2', symbol: 'USDCe' },
    typedValue: '18.43',
    toAmount: 19.84,
    fromUsd: 19.94,
    toUsd: 19.84,
    canReview: true,
    isQuoting: false,
    isSending: false,
    error: undefined,
    execute: mockExecute,
  };
});
afterEach(() => act(() => root.unmount()));

it('names what is about to be swapped on the button, behind the passkey', () => {
  mount();
  expect(text()).toContain('Swap ');
  expect(text()).toContain('18.43');
  expect(text()).toContain('USD Yield');
  expect(root.root.findAllByType('Image')).toHaveLength(1);
});

it('lands on Swapped with the receipt (05)', async () => {
  const receipt = { kind: 'completed', toAmount: 19.84 };
  mockExecute.mockResolvedValue(receipt);
  mount();
  await swap();
  expect(mockSetReceipt).toHaveBeenCalledWith(receipt);
  expect(mockSetModal).toHaveBeenLastCalledWith(SWAP_MODAL.OPEN_SWAPPED);
});

it('follows a cross-network swap on its way (06)', async () => {
  mockExecute.mockResolvedValue({ kind: 'bridging', toAmount: 44.62 });
  mount();
  await swap();
  expect(mockSetModal).toHaveBeenLastCalledWith(SWAP_MODAL.OPEN_ON_ITS_WAY);
});

it('stays put when the signature is cancelled', async () => {
  mockExecute.mockResolvedValue(undefined);
  mount();
  await swap();
  expect(mockSetModal).not.toHaveBeenCalled();
});

it('says the price moved instead of signing a worse one', async () => {
  const { SwapFlowStop } = jest.requireMock('@/hooks/swap/useSwapFlow');
  mockExecute.mockRejectedValue(new SwapFlowStop('PRICE_CHANGED'));
  mount();
  await swap();
  expect(text()).toContain('The price changed. Check the new amount and swap again.');
  expect(mockFailureSheet).not.toHaveBeenCalled();
});

it('opens the failure sheet with Try again, and tracks a clean error (10)', async () => {
  mockExecute.mockRejectedValue(
    new Error(
      'UserOperation reverted. URL: https://api.pimlico.io/v2/122/rpc?apikey=pim_secret123456',
    ),
  );
  mount();
  await swap();
  expect(mockFailureSheet).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ action: 'swap', retryLabel: 'Try again' }),
  );
  const failed = mockTrack.mock.calls.find(([event]) => event === 'swap_failed');
  expect(failed[1]).toMatchObject({ error_code: 'SWAP_FAILED', flow: 'new' });
  expect(failed[1].error).not.toContain('pim_secret123456');
});

it('goes back to the form if the swap stops being possible while open', () => {
  mockModel.error = { code: 'NOT_ENOUGH_BALANCE', copy: 'x' };
  mount();
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_FORM);
});
