import {
  formatSwapAmount,
  formatSwapUsd,
  groupAmountInput,
  sanitizeAmountInput,
} from '@/lib/utils/swap/format';

describe('swap number formatting', () => {
  it.each([
    [18.43, '18.43'],
    [19.8412, '19.84'],
    [145000, '145,000'],
    [0.0081234, '0.008123'],
    [0.00081234, '0.000812'],
    [0.5, '0.5'],
    [0, '0'],
    [0.0000001, '<0.000001'],
  ])('writes the amount %p as %p', (value, expected) => {
    expect(formatSwapAmount(value)).toBe(expected);
  });

  it.each([
    [19.94, '$19.94'],
    [1204.1, '$1,204.10'],
    [0.004, '<$0.01'],
    [0, '$0.00'],
  ])('writes $%p as %p', (value, expected) => {
    expect(formatSwapUsd(value)).toBe(expected);
  });

  it.each([
    ['18,43', 6, '18.43'],
    ['1.2.3', 6, '1.23'],
    ['0012', 6, '12'],
    ['.5', 6, '0.5'],
    ['1.1234567', 6, '1.123456'],
    ['1,234', 6, '1.234'],
    ['abc', 6, ''],
    ['5.', 6, '5.'],
  ])('keeps %p as %p for a %p-decimal token', (raw, decimals, expected) => {
    expect(sanitizeAmountInput(raw, decimals as number)).toBe(expected);
  });

  it('groups thousands while typing and keeps the point', () => {
    expect(groupAmountInput('1234567.5')).toBe('1,234,567.5');
    expect(groupAmountInput('1000.')).toBe('1,000.');
    expect(groupAmountInput('12')).toBe('12');
  });
});
