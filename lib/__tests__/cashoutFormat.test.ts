/// <reference types="jest" />

import { formatCashoutFiat, formatCashoutRate } from '@/lib/cashoutFormat';

describe('cashoutFormat', () => {
  it('works the rate out from the amounts, fees added back', () => {
    // 100 USDC → 91.85 EUR after 1.80 EUR of fees = 0.9365 EUR per USDC.
    expect(
      formatCashoutRate(
        {
          usdcAmount: '100',
          fiatCurrency: 'EUR',
          paymentCode: 'sepa_bank',
          fiatAmount: 91.85,
          totalFee: 1.8,
        },
        'EUR',
      ),
    ).toMatch(/^1 USDC ≈ 0[.,]9365 EUR$/);
  });

  it('says so when there is nothing to work it out from', () => {
    expect(
      formatCashoutRate({ usdcAmount: '0', fiatCurrency: 'EUR', paymentCode: 'x' }, 'EUR'),
    ).toBe('Not available');
    expect(formatCashoutFiat(undefined, 'EUR')).toBe('Not available');
  });
});
