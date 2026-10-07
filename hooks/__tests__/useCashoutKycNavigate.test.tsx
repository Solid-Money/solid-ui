import React, { useEffect } from 'react';

import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { useCashoutKycNavigate } from '@/hooks/useCashout';

// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockSetModal = jest.fn();
const mockSetKycModal = jest.fn();

jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: { setModal: jest.Mock }) => unknown) =>
    selector({ setModal: mockSetModal }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: { setKycModal: jest.Mock }) => unknown) =>
    selector({ setKycModal: mockSetKycModal }),
}));
// Pulled in by useCashout for the entry and balance hooks; not under test here.
jest.mock('@/hooks/useBuyCryptoEntry', () => ({ useBuyCryptoEntry: jest.fn() }));
jest.mock('@/hooks/useWalletTokens', () => ({ useWalletTokens: jest.fn() }));

let navigate: ReturnType<typeof useCashoutKycNavigate>;

function Harness() {
  const result = useCashoutKycNavigate();
  useEffect(() => {
    navigate = result;
  });
  return null;
}

/**
 * The shared TransFi KYC screens speak in deposit-drawer steps. Inside the Send
 * drawer each one has to land somewhere that makes sense for a cash-out.
 */
describe('useCashoutKycNavigate', () => {
  beforeAll(() => {
    act(() => {
      create(<Harness />);
    });
  });
  beforeEach(() => jest.clearAllMocks());

  it('starts the cash-out where a verified buyer would see the amount screen', () => {
    navigate(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
    expect(mockSetModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_CURRENCY);
    expect(mockSetKycModal).toHaveBeenCalledWith(null);
  });

  it('shows KYC screens inside the Send drawer', () => {
    navigate(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT);
    expect(mockSetKycModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT);
    expect(mockSetModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_KYC);
  });

  it('closes the Send drawer, not the deposit one', () => {
    navigate(DEPOSIT_MODAL.CLOSE);
    expect(mockSetModal).toHaveBeenCalledWith(SEND_MODAL.CLOSE);
  });

  it('goes back to search where the buy flow would go back to its options', () => {
    navigate(DEPOSIT_MODAL.OPEN_OPTIONS);
    expect(mockSetModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_SEND_SEARCH);
  });
});
