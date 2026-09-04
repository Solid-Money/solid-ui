import { getPaymentMethodChips } from '@/components/DepositOption/depositPaymentMethods';

describe('getPaymentMethodChips', () => {
  it('uses provider names, normalizes known acronyms, and removes duplicates', () => {
    expect(
      getPaymentMethodChips([
        { paymentCode: 'pix', paymentName: 'Pix' },
        { paymentCode: 'pix_duplicate', paymentName: 'PIX' },
        { paymentCode: 'bank', paymentName: 'Bank transfer' },
      ]),
    ).toEqual(['PIX', 'Bank transfer']);
  });

  it('falls back to the payment code and summarizes overflow', () => {
    expect(
      getPaymentMethodChips(
        [
          { paymentCode: 'ach' },
          { paymentCode: 'wire' },
          { paymentCode: 'apple_pay' },
          { paymentCode: 'card' },
        ],
        3,
      ),
    ).toEqual(['ACH', 'Wire', 'Apple Pay', '+1']);
  });

  it('returns no labels while methods are unavailable', () => {
    expect(getPaymentMethodChips(undefined)).toEqual([]);
    expect(getPaymentMethodChips([])).toEqual([]);
  });
});
