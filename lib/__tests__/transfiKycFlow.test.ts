/// <reference types="jest" />

import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { isTransfiKycFlow, resumeTransfiKycFlow } from '@/lib/transfiKycFlow';

const mockSetKycModal = jest.fn();
const mockSetSendModal = jest.fn();
const mockSetDepositModal = jest.fn();

jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: { getState: () => ({ setKycModal: mockSetKycModal }) },
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: { getState: () => ({ setModal: mockSetSendModal }) },
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: { getState: () => ({ setModal: mockSetDepositModal }) },
}));

describe('transfiKycFlow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats both TransFi flows as TransFi identity checks', () => {
    expect(isTransfiKycFlow('transfi')).toBe(true);
    expect(isTransfiKycFlow('transfi_cashout')).toBe(true);
    expect(isTransfiKycFlow('card')).toBe(false);
    expect(isTransfiKycFlow(null)).toBe(false);
  });

  it('returns a cash-out user to the Send drawer at the KYC pending step', () => {
    resumeTransfiKycFlow('transfi_cashout');
    expect(mockSetKycModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
    expect(mockSetSendModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_KYC);
    expect(mockSetDepositModal).not.toHaveBeenCalled();
  });

  it('still returns a buy-crypto user to the deposit drawer', () => {
    resumeTransfiKycFlow('transfi');
    expect(mockSetDepositModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
    expect(mockSetSendModal).not.toHaveBeenCalled();
  });
});
