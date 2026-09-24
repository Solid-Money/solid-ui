import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

/**
 * Where "Crypto" leads from the "Deposit with" chooser.
 *
 * "Receive crypto" offers the deposit address and, on desktop only, connect
 * wallet — thirdweb's connect modal being desktop-only. With one option there is
 * nothing to choose, so a phone skips it and lands on the token list rather than
 * being asked to confirm the only way through.
 */
export const getCryptoDepositEntry = (isDesktop: boolean): DepositModal =>
  isDesktop ? DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO : DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN;

/**
 * Where back goes from "Select token", which is reached from two directions: on
 * the way in to the address, and again from the address screen's currency pill.
 *
 * Which one opened it is recorded by the pill (`isChangingToken`) rather than
 * read from the previous step: stepping back from the address also lands here
 * with the address as the previous step, and treating that as the pill would
 * send back straight forward to the address again. On the way in, a phone never
 * sees "Receive crypto", so it returns to the chooser instead.
 */
export const getDepositTokenBackTarget = (
  isChangingToken: boolean,
  isDesktop: boolean,
): DepositModal => {
  if (isChangingToken) {
    return DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS;
  }

  return isDesktop ? DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO : DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE;
};
