import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

export type BuyCryptoBackTarget = DepositModal | 'entry';
export type EmbeddedBuyCryptoTarget = DepositModal | 'entry' | 'close';

/** Translate global-flow exit states into actions owned by the funding modal. */
export const getEmbeddedBuyCryptoTarget = (modal: DepositModal): EmbeddedBuyCryptoTarget => {
  if (modal.name === DEPOSIT_MODAL.CLOSE.name) return 'close';
  if (modal.name === DEPOSIT_MODAL.OPEN_OPTIONS.name) return 'entry';
  return modal;
};

export const getBuyCryptoTitle = (modal: DepositModal) => {
  switch (modal.name) {
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT.name:
      return 'Verify to continue';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING.name:
      return 'Verifying';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT.name:
      return 'Buy crypto';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY.name:
      return 'Select currency';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD.name:
      return 'Payment method';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT.name:
      return 'Complete payment';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS.name:
      return 'Order status';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PROFILE.name:
      return 'Complete your details';
    default:
      return undefined;
  }
};

export const getBuyCryptoBackTarget = (modal: DepositModal): BuyCryptoBackTarget | null => {
  switch (modal.name) {
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT.name:
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING.name:
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT.name:
      return 'entry';
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY.name:
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD.name:
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT.name:
      return DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT;
    case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PROFILE.name:
      return DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR;
    default:
      return null;
  }
};
