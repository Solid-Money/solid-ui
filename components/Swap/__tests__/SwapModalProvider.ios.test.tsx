import React from 'react';
import { Platform } from 'react-native';

import SwapModalProvider from '@/components/Swap/SwapModalProvider';
import { SWAP_MODAL } from '@/constants/modals';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('zustand/react/shallow', () => ({ useShallow: (selector: unknown) => selector }));
jest.mock('@/components/Compliance/ExchangeDisclaimer', () => 'ExchangeDisclaimer');
jest.mock('@/components/Compliance/GeoRestrictionNotice', () => 'GeoRestrictionNotice');
jest.mock('@/components/NeedHelp', () => 'NeedHelp');
jest.mock('@/components/ResponsiveModal', () => 'ResponsiveModal');
jest.mock('@/components/Swap/BuyFuseScreen', () => 'BuyFuseScreen');
jest.mock('@/components/Swap/SwapButton', () => 'SwapButton');
jest.mock('@/components/Swap/SwapPair', () => 'SwapPair');
jest.mock('@/components/Swap/SwapParams', () => 'SwapParams');
jest.mock('@/components/TransactionStatus', () => 'TransactionStatus');
jest.mock('@/hooks/useGeoCompliance', () => ({
  __esModule: true,
  default: () => ({ isSwapAvailable: mockSwapAvailable }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/getTokenIcon', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/store/useComplianceStore', () => ({
  useComplianceStore: (selector: (state: any) => unknown) =>
    selector({ hasAcceptedDisclaimer: () => true, acceptDisclaimer: jest.fn() }),
}));
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: (state: any) => unknown) =>
    selector({
      currentModal: mockCurrentModal,
      previousModal: { name: 'close', number: 0 },
      transaction: {},
      buyFuseTier: undefined,
      buyFuseUpgrade: mockBuyFuseUpgrade,
      actions: { setModal: jest.fn() },
    }),
}));

let mockCurrentModal = SWAP_MODAL.CLOSE;
let mockSwapAvailable = true;
let mockBuyFuseUpgrade: { tier: RewardsTier; depositToSavings: boolean } | undefined;
const originalPlatform = Platform.OS;

const render = () => {
  let root: any;
  act(() => {
    root = create(<SwapModalProvider />);
  });
  return root;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Platform.OS = 'ios';
  mockSwapAvailable = true;
  mockCurrentModal = SWAP_MODAL.CLOSE;
  mockBuyFuseUpgrade = undefined;
});

afterEach(() => {
  Platform.OS = originalPlatform;
});

it('renders Buy FUSE on iOS', () => {
  mockCurrentModal = SWAP_MODAL.OPEN_BUY_FUSE;
  mockBuyFuseUpgrade = { tier: RewardsTier.ULTRA, depositToSavings: false };
  const root = render();
  expect(root.root.findAllByType('ResponsiveModal')).toHaveLength(1);
  expect(root.root.findByType('BuyFuseScreen').props.upgradeContext).toEqual(mockBuyFuseUpgrade);
  act(() => root.unmount());
});

it('keeps the regular Swap modal hidden on iOS', () => {
  mockCurrentModal = SWAP_MODAL.OPEN_FORM;
  const root = render();
  expect(root.root.findAllByType('ResponsiveModal')).toHaveLength(0);
  act(() => root.unmount());
});

it('shows the restriction notice when Buy FUSE is unavailable in the current country', () => {
  mockCurrentModal = SWAP_MODAL.OPEN_BUY_FUSE;
  mockSwapAvailable = false;
  const root = render();
  expect(root.root.findAllByType('GeoRestrictionNotice')).toHaveLength(1);
  expect(root.root.findAllByType('BuyFuseScreen')).toHaveLength(0);
  act(() => root.unmount());
});
