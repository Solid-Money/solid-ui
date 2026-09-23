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
    expect(getDepositChainBackTarget(true, true)).toBe(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
    expect(getDepositChainBackTarget(true, false)).toBe(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  });

  it('returns to "Receive crypto" on the way in, on desktop', () => {
    expect(getDepositChainBackTarget(false, true)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO);
  });

  // A phone never sees "Receive crypto", so sending it back there would land the
  // user on a screen that is not in their flow.
  it('returns to the chooser on the way in, on a phone', () => {
    expect(getDepositChainBackTarget(false, false)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
  });

  // Back from the address lands on the chain list with the address as the
  // previous step; back again must leave, not bounce forward to the address.
  it('leaves the flow after stepping back from the address', () => {
    expect(getDepositChainBackTarget(false, false)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
    expect(getDepositChainBackTarget(false, true)).toBe(DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO);
  });
});
