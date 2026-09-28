import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

/**
 * Host-side description of the Cash App steps, so a funding modal can render
 * them in its own shell — title, back target, and which steps belong to the
 * flow at all.
 *
 * Mirrors lib/buyCryptoFlow.ts. The two providers share no code, but a host
 * embedding either needs the same three answers.
 */
export type OrchestraBackTarget = DepositModal | 'entry';

export const ORCHESTRA_MODAL_NAMES: readonly string[] = [
  DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT.name,
  DEPOSIT_MODAL.OPEN_ORCHESTRA_INVOICE.name,
  DEPOSIT_MODAL.OPEN_ORCHESTRA_STATUS.name,
  DEPOSIT_MODAL.OPEN_ORCHESTRA_ERROR.name,
];

export const isOrchestraModal = (modal: DepositModal | null | undefined): boolean =>
  !!modal && ORCHESTRA_MODAL_NAMES.includes(modal.name);

export const getOrchestraTitle = (modal: DepositModal) => {
  switch (modal.name) {
    case DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT.name:
      return 'Cash App';
    case DEPOSIT_MODAL.OPEN_ORCHESTRA_INVOICE.name:
      return 'Pay with Cash App';
    case DEPOSIT_MODAL.OPEN_ORCHESTRA_STATUS.name:
      return 'Deposit status';
    // The error screen carries its own headline and icon.
    default:
      return undefined;
  }
};

/**
 * Where back goes from each step, or null where there is nowhere sensible.
 *
 * Null past the invoice is deliberate: by the status step an invoice may
 * already be paid, and the error screen is where a failure sent the user, so
 * returning to the step that raised it would only reproduce it.
 */
export const getOrchestraBackTarget = (modal: DepositModal): OrchestraBackTarget | null => {
  switch (modal.name) {
    case DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT.name:
      return 'entry';
    case DEPOSIT_MODAL.OPEN_ORCHESTRA_INVOICE.name:
      return DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT;
    default:
      return null;
  }
};
