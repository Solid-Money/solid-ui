/// <reference types="jest" />

import { formatDecimalAmount } from '@/lib/support/formatAmount';

describe('formatDecimalAmount', () => {
  it.each([
    ['1234.5', '1,234.50'],
    ['1234567.123456789', '1,234,567.123456'],
    ['0.000012345678', '0.000012'],
    ['0.5', '0.5'],
    ['12', '12.00'],
    ['-3.1', '-3.10'],
    ['000123.400', '123.40'],
    // More digits than a float keeps.
    ['123456789012345678.123456789', '123,456,789,012,345,678.123456'],
  ])('shows %s as %s', (input, expected) => {
    expect(formatDecimalAmount(input)).toBe(expected);
  });

  it('leaves anything that is not a plain decimal as it came', () => {
    expect(formatDecimalAmount('1e-7')).toBe('1e-7');
    expect(formatDecimalAmount('n/a')).toBe('n/a');
  });
});
