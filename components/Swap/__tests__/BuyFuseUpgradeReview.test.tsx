import React from 'react';

import BuyFuseUpgradeReview from '@/components/Swap/BuyFuseUpgradeReview';
import { DEPOSIT_MODAL, SWAP_MODAL } from '@/constants/modals';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/constants/vaults', () => ({ VAULTS: [{ name: 'USDC' }, { name: 'FUSE' }] }));
jest.mock('@/store/swapStore', () => ({
  useSwapState: { getState: () => ({ actions: { setModal: mockCloseSwap } }) },
}));
jest.mock('@/store/useDepositStore', () => ({ useDepositStore: { getState: () => mockDeposit } }));
jest.mock('@/store/useSavingStore', () => ({
  useSavingStore: { getState: () => ({ selectVaultForDeposit: mockSelectVault }) },
}));
jest.mock('@/store/useTierUpgradeStore', () => ({
  useTierUpgradeStore: { getState: () => mockUpgrade },
}));

const mockCloseSwap = jest.fn();
const mockSelectVault = jest.fn();
const mockDeposit = {
  resetDepositFlow: jest.fn(),
  setSrcChainId: jest.fn(),
  setPrincipalToken: jest.fn(),
  setDepositFromSolid: jest.fn(),
  setModal: jest.fn(),
};
const mockUpgrade = {
  open: jest.fn(),
  setRoute: jest.fn(),
  setLockAsset: jest.fn(),
};

const render = (depositToSavings: boolean) => {
  let root: any;
  act(() => {
    root = create(<BuyFuseUpgradeReview context={{ tier: RewardsTier.ULTRA, depositToSavings }} />);
  });
  return root;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

it('returns a native FUSE purchase to the lock upgrade', () => {
  const root = render(false);
  act(() => root.root.findAllByType('Button')[0].props.onPress());
  expect(mockCloseSwap).toHaveBeenCalledWith(SWAP_MODAL.CLOSE);
  expect(mockUpgrade.open).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(200));
  expect(mockUpgrade.open).toHaveBeenCalledWith(RewardsTier.ULTRA);
  expect(mockUpgrade.setRoute).toHaveBeenCalledWith('lock');
  expect(mockUpgrade.setLockAsset).toHaveBeenCalledWith('FUSE');
  expect(mockDeposit.setModal).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('opens Savings funding only when the chosen upgrade asset was soFUSE', () => {
  const root = render(true);
  act(() => root.root.findAllByType('Button')[0].props.onPress());
  expect(mockCloseSwap).toHaveBeenCalledWith(SWAP_MODAL.CLOSE);
  act(() => jest.advanceTimersByTime(200));
  expect(mockSelectVault).toHaveBeenCalledWith(1);
  expect(mockDeposit.setPrincipalToken).toHaveBeenCalledWith('FUSE');
  expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_FORM);
  expect(mockUpgrade.open).not.toHaveBeenCalled();
  act(() => root.unmount());
});
