import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

/**
 * Where "Crypto" leads from the "Deposit with" chooser.
 *
 * "Receive crypto" offers the deposit address and, on desktop only, connect
 * wallet — thirdweb's connect modal being desktop-only. With one option there is
 * nothing to choose, so a phone skips it and lands on the chain list rather than
 * being asked to confirm the only way through.
 */
export const getCryptoDepositEntry = (isDesktop: boolean): DepositModal =>
  isDesktop ? DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO : DEPOSIT_MODAL.OPEN_DEPOSIT_CHAIN;

/**
 * Where back goes from "Select chain", which is reached from two directions: on
 * the way in to the address, and again from the address screen's network button.
 *
 * Returning to whichever opened it is the only behaviour that works for both. A
 * fixed target sends the second case to a screen the user was not on, and on a
 * phone it would be a screen that does not exist in their flow at all.
 *
 * Which one opened it is recorded by the network button (`isChangingChain`)
 * rather than read from the previous step: stepping back from the address also
 * lands here with the address as the previous step, and treating that as the
 * network button sent back straight forward to the address again.
 */
export const getDepositChainBackTarget = (
  isChangingChain: boolean,
  isDesktop: boolean,
): DepositModal => {
  if (isChangingChain) {
    return DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS;
  }

  return isDesktop ? DEPOSIT_MODAL.OPEN_DEPOSIT_CRYPTO : DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE;
};
