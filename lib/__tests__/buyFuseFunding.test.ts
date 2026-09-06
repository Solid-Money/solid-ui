import { formatBuyFuseFundingBalance } from '@/lib/buyFuseFunding';

describe('formatBuyFuseFundingBalance', () => {
  it('does not present an unavailable balance as zero', () => {
    expect(formatBuyFuseFundingBalance(undefined)).toBe('—');
  });

  it('shows a confirmed zero balance', () => {
    expect(formatBuyFuseFundingBalance('0')).toBe('0');
  });

  it('preserves the existing funding balance formatting', () => {
    expect(formatBuyFuseFundingBalance('1234.5678')).toBe('1,234.57');
    expect(formatBuyFuseFundingBalance('25')).toBe('25');
  });

  it.each(['', ' ', 'NaN', 'Infinity', '-1'])('does not display invalid balance %j', value => {
    expect(formatBuyFuseFundingBalance(value)).toBe('—');
  });
});
