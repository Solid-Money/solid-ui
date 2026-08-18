import { toAmountInputValue } from '@/lib/utils/cardHelpers';

describe('toAmountInputValue', () => {
  it('produces a value the amount field can parse back', () => {
    // `formatNumber` is display-only: it delegates to Intl.NumberFormat, which
    // groups thousands into a string Number() cannot read. Feeding that back
    // into the field is why "Max" on a four-figure balance failed validation.
    const displayed = new Intl.NumberFormat('en-us', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.56);
    expect(displayed).toBe('1,234.56');
    expect(Number(displayed)).toBeNaN();

    expect(toAmountInputValue(1234.56)).toBe('1234.56');
    expect(Number(toAmountInputValue(1234.56))).toBe(1234.56);
  });

  it('floors to the cent so Max never exceeds the real balance', () => {
    expect(toAmountInputValue(100.949)).toBe('100.94');
    expect(toAmountInputValue(0.409)).toBe('0.40');
    expect(Number(toAmountInputValue(100.949))).toBeLessThanOrEqual(100.949);
  });

  it('keeps two decimals for whole and sub-dollar amounts', () => {
    expect(toAmountInputValue(5)).toBe('5.00');
    expect(toAmountInputValue(0.4)).toBe('0.40');
  });

  it('collapses empty, negative and non-finite balances to zero', () => {
    expect(toAmountInputValue(0)).toBe('0');
    expect(toAmountInputValue(-1)).toBe('0');
    expect(toAmountInputValue(NaN)).toBe('0');
    expect(toAmountInputValue(Infinity)).toBe('0');
  });
});
