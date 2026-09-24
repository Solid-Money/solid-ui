import React from 'react';
import { Platform } from 'react-native';

import DepositTypeSelection from '@/components/DepositOption/DepositTypeSelection';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/DepositOption/DepositCashOptions', () => ({
  DEPOSIT_CASH_CLUSTER_ICONS: [],
  DEPOSIT_CASH_CURRENCY_COUNT: 0,
}));
jest.mock('@/components/DepositOption/DepositIconCluster', () => 'DepositIconCluster');
jest.mock('@/components/DepositOption/DepositMethodRow', () => 'DepositMethodRow');
jest.mock('@/hooks/useDimension', () => ({
  useDimension: () => ({ isDesktop: false, isScreenMedium: false }),
}));
jest.mock('@/hooks/useSavingsFundFlow', () => ({
  useSavingsFundFlow: () => ({ selectToken: mockSelectSavingsToken }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: (state: any) => unknown) =>
    selector({ actions: { openBuyFuse: mockOpenBuyFuse } }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: Object.assign((selector: (state: any) => unknown) => selector(mockDeposit), {
    getState: () => mockDeposit,
  }),
}));

const mockSelectSavingsToken = jest.fn();
const mockOpenBuyFuse = jest.fn();
const mockDeposit = {
  upgradeTopUp: undefined as undefined | { tier: RewardsTier; depositToSavings: boolean },
  setModal: jest.fn(),
  resetDepositFlow: jest.fn(),
  setSavingsFundIntent: jest.fn(),
};
const originalPlatform = Platform.OS;

const render = () => {
  let root: any;
  act(() => {
    root = create(<DepositTypeSelection onClose={jest.fn()} />);
  });
  return root;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockDeposit.upgradeTopUp = undefined;
  Platform.OS = 'android';
});

afterEach(() => {
  jest.useRealTimers();
  Platform.OS = originalPlatform;
});

it('keeps Buy FUSE out of the ordinary deposit chooser', () => {
  const root = render();
  const rows = root.root.findAllByType('DepositMethodRow');
  expect(rows.map((row: any) => row.props.title)).toEqual(['Crypto', 'Cash']);
  act(() => rows[0].props.onPress());
  expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN);
  act(() => root.unmount());
});

it('offers Buy FUSE from upgrade Top up on iOS', () => {
  Platform.OS = 'ios';
  mockDeposit.upgradeTopUp = { tier: RewardsTier.ULTRA, depositToSavings: false };
  const root = render();
  const rows = root.root.findAllByType('DepositMethodRow');
  expect(rows.map((row: any) => row.props.title)).toEqual(['Crypto', 'Cash', 'Buy FUSE']);
  act(() => rows[2].props.onPress());
  act(() => jest.advanceTimersByTime(200));
  expect(mockOpenBuyFuse).toHaveBeenCalledWith(RewardsTier.ULTRA, {
    depositToSavings: false,
  });
  act(() => root.unmount());
});

it('opens Buy FUSE for the selected upgrade tier after closing the deposit drawer', () => {
  mockDeposit.upgradeTopUp = { tier: RewardsTier.ULTRA, depositToSavings: false };
  const root = render();
  const rows = root.root.findAllByType('DepositMethodRow');
  expect(rows.map((row: any) => row.props.title)).toEqual(['Crypto', 'Cash', 'Buy FUSE']);

  act(() => rows[2].props.onPress());
  expect(mockDeposit.resetDepositFlow).toHaveBeenCalledTimes(1);
  expect(mockOpenBuyFuse).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(200));
  expect(mockOpenBuyFuse).toHaveBeenCalledWith(RewardsTier.ULTRA, {
    depositToSavings: false,
  });
  act(() => root.unmount());
});

it('preserves the existing Savings deposit route for Crypto from a soFUSE top up', () => {
  mockDeposit.upgradeTopUp = { tier: RewardsTier.PRIME, depositToSavings: true };
  const root = render();
  act(() => root.root.findAllByType('DepositMethodRow')[0].props.onPress());
  expect(mockDeposit.setSavingsFundIntent).toHaveBeenCalledWith('savings');
  expect(mockSelectSavingsToken).toHaveBeenCalledWith('WFUSE');
  expect(mockDeposit.setModal).not.toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN);
  act(() => root.unmount());
});
