import { DEPOSIT_MODAL } from '@/constants/modals';
import {
  getBuyCryptoBackTarget,
  getBuyCryptoTitle,
  getEmbeddedBuyCryptoTarget,
} from '@/lib/buyCryptoFlow';

describe('embedded Buy crypto navigation', () => {
  it.each([
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_CONSENT,
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING,
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT,
  ])('returns the first Buy crypto screen to its funding entry from $name', modal => {
    expect(getBuyCryptoBackTarget(modal)).toBe('entry');
  });

  it.each([
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY,
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD,
    DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT,
  ])('returns the nested $name step to the amount form', modal => {
    expect(getBuyCryptoBackTarget(modal)).toBe(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
  });

  it('does not put a back button on terminal status and error screens', () => {
    expect(getBuyCryptoBackTarget(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS)).toBeNull();
    expect(getBuyCryptoBackTarget(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR)).toBeNull();
  });

  it('keeps global exit controls inside the funding modal lifecycle', () => {
    expect(getEmbeddedBuyCryptoTarget(DEPOSIT_MODAL.OPEN_OPTIONS)).toBe('entry');
    expect(getEmbeddedBuyCryptoTarget(DEPOSIT_MODAL.CLOSE)).toBe('close');
    expect(getEmbeddedBuyCryptoTarget(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT)).toBe(
      DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT,
    );
  });

  it('keeps the embedded header titles aligned with the global flow', () => {
    expect(getBuyCryptoTitle(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT)).toBe('Buy crypto');
    expect(getBuyCryptoTitle(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_CURRENCY)).toBe('Select currency');
    expect(getBuyCryptoTitle(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD)).toBe('Payment method');
  });
});
