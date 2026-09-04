import React from 'react';

import BuyFuseSavingsReview from '@/components/Swap/BuyFuseSavingsReview';
import { DEPOSIT_MODAL, SWAP_MODAL } from '@/constants/modals';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/constants/vaults', () => ({ VAULTS: [{ name: 'USDC' }, { name: 'FUSE' }] }));
jest.mock('@/store/swapStore', () => ({
  useSwapState: { getState: () => ({ actions: { setModal: mockClose } }) },
}));
jest.mock('@/store/useSavingStore', () => ({
  useSavingStore: { getState: () => ({ selectVaultForDeposit: mockVault }) },
}));
jest.mock('@/store/useDepositStore', () => ({ useDepositStore: { getState: () => mockDeposit } }));
const mockClose = jest.fn(),
  mockVault = jest.fn();
const mockDeposit = {
  resetDepositFlow: jest.fn(),
  setSrcChainId: jest.fn(),
  setPrincipalToken: jest.fn(),
  setDepositFromSolid: jest.fn(),
  setModal: jest.fn(),
};
let root: any;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  act(() => {
    root = create(<BuyFuseSavingsReview />);
  });
});
afterEach(() => act(() => root.unmount()));
it('opens the existing confirmation form for native FUSE in the soFUSE vault', () => {
  act(() => root.root.findAllByType('Button')[0].props.onPress());
  expect(mockClose).toHaveBeenCalledWith(SWAP_MODAL.CLOSE);
  expect(mockVault).toHaveBeenCalledWith(1);
  expect(mockDeposit.setSrcChainId).toHaveBeenCalledWith(122);
  expect(mockDeposit.setPrincipalToken).toHaveBeenCalledWith('FUSE');
  expect(mockDeposit.setDepositFromSolid).toHaveBeenCalledWith(true);
  expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_FORM);
});
it('leaves the purchase in the wallet when the user declines the deposit', () => {
  act(() => root.root.findAllByType('Button')[1].props.onPress());
  expect(mockClose).toHaveBeenCalledWith(SWAP_MODAL.CLOSE);
  expect(mockDeposit.setModal).not.toHaveBeenCalled();
  expect(mockVault).not.toHaveBeenCalled();
});
