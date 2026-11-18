/// <reference types="jest" />

import { formatBtcRowAmount } from '@/lib/btcAmount';

describe('formatBtcRowAmount', () => {
  it.each([
    // Trailing zeros dropped, whole coins kept whole
    ['1.00000000', '1'],
    ['1.20000000', '1.2'],
    ['10', '10'],
    ['0', '0'],
    // Cut to six places, not rounded
    ['0.12345678', '0.123456'],
    ['0.00000099', '< 0.000001'],
    ['-0.5', '-0.5'],
    ['1234.5', '1,234.5'],
    // More digits than a float keeps
    ['123456789012345678.123456789', '123,456,789,012,345,678.123456'],
    // Exponent form, as a number's toString writes it below 1e-6
    ['1e-8', '< 0.000001'],
    ['2.5e-6', '0.000002'],
    ['1.5E+3', '1,500'],
  ])('shows %s as %s', (input, expected) => {
    expect(formatBtcRowAmount(input, 6)).toBe(expected);
  });

  it('leaves text that is not a number as it came', () => {
    expect(formatBtcRowAmount('n/a', 6)).toBe('n/a');
  });
});
