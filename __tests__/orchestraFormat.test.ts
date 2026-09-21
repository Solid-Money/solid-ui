import { formatSats, formatSmallestUnits } from '@/lib/orchestraFormat';

describe('formatSmallestUnits', () => {
  it('renders smallest units at the asset decimals', () => {
    expect(formatSmallestUnits('49750000', 6)).toBe('49.75');
    expect(formatSmallestUnits('250000', 6)).toBe('0.25');
    expect(formatSmallestUnits('50000000', 6)).toBe('50');
    expect(formatSmallestUnits('1', 6)).toBe('0');
  });

  it('pads when the asset has fewer decimals than requested places', () => {
    expect(formatSmallestUnits('4975', 2, 4)).toBe('49.75');
    expect(formatSmallestUnits('7', 0, 2)).toBe('7');
  });

  it('rounds on the first dropped digit without going through a float', () => {
    expect(formatSmallestUnits('49755000', 6)).toBe('49.76');
    expect(formatSmallestUnits('49754000', 6)).toBe('49.75');
    expect(formatSmallestUnits('999999', 6, 2)).toBe('1');
    expect(formatSmallestUnits('5000000000000000000000', 18, 2)).toBe('5,000');
  });

  it('rejects anything that is not an integer string', () => {
    expect(formatSmallestUnits('49.75', 6)).toBeUndefined();
    expect(formatSmallestUnits(undefined, 6)).toBeUndefined();
    expect(formatSmallestUnits('100', undefined)).toBeUndefined();
  });

  it('groups sats', () => {
    expect(formatSats('44210')).toBe('44,210 sats');
    expect(formatSats('abc')).toBeUndefined();
  });
});
