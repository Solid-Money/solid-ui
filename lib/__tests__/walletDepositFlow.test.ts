import { DEPOSIT_MODAL } from '@/constants/modals';
import { getCryptoDepositEntry, getDepositChainBackTarget } from '@/lib/walletDepositFlow';

describe('getCryptoDepositEntry', () => {
  it('stops at "Receive crypto" on desktop, where there are two ways through', () => {
    expect(getCryptoDepositEntry(true)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO);
  });

  // Connect wallet is desktop-only, so that screen is a single row on a phone.
  it('skips straight to the chain list on a phone', () => {
    expect(getCryptoDepositEntry(false)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_CHAIN);
  });
});

describe('getDepositChainBackTarget', () => {
  // Opened from the address screen's network button: back belongs there, not at
  // the start of the flow.
  it('returns to the address when that is where it was opened from', () => {
    expect(getDepositChainBackTarget(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS, true)).toBe(
      DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS,
    );
    expect(getDepositChainBackTarget(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS, false)).toBe(
      DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS,
    );
  });

  it('returns to "Receive crypto" on the way in, on desktop', () => {
    expect(getDepositChainBackTarget(DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO, true)).toBe(
      DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO,
    );
  });

  // A phone never sees "Receive crypto", so sending it back there would land the
  // user on a screen that is not in their flow.
  it('returns to the chooser on the way in, on a phone', () => {
    expect(getDepositChainBackTarget(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE, false)).toBe(
      DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE,
    );
    expect(getDepositChainBackTarget(DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO, false)).toBe(
      DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE,
    );
  });
});
