import {
  formatCompactVaultUsd,
  formatExactVaultUsd,
} from '@/components/Savings/NewSavings/vaultBalanceFormat';

// The real barrel pulls in wagmi; only `formatNumber`'s one-decimal case matters here.
jest.mock('@/lib/utils', () => ({
  formatNumber: (value: number, max: number, min: number) =>
    new Intl.NumberFormat('en-us', {
      maximumFractionDigits: max,
      minimumFractionDigits: value >= 1 ? min : 0,
    }).format(value),
}));

describe('formatCompactVaultUsd', () => {
  it('keeps values under a thousand as they are, to two decimals', () => {
    expect(formatCompactVaultUsd(0)).toBe('0 USD');
    expect(formatCompactVaultUsd(1.764)).toBe('1.76 USD');
    expect(formatCompactVaultUsd(363.86)).toBe('363.86 USD');
    expect(formatCompactVaultUsd(12.5)).toBe('12.5 USD');
  });

  it('compacts thousands and up without relying on Intl compact notation', () => {
    expect(formatCompactVaultUsd(6759.16)).toBe('6.76K USD');
    expect(formatCompactVaultUsd(1000)).toBe('1K USD');
    expect(formatCompactVaultUsd(2_500_000)).toBe('2.5M USD');
    expect(formatCompactVaultUsd(3_210_000_000)).toBe('3.21B USD');
    expect(formatCompactVaultUsd(4e12)).toBe('4T USD');
  });

  it('promotes a value that rounds up into the next unit', () => {
    expect(formatCompactVaultUsd(999.999)).toBe('1K USD');
    expect(formatCompactVaultUsd(999_999)).toBe('1M USD');
  });

  it('treats negative and non-numeric input as zero', () => {
    expect(formatCompactVaultUsd(-5)).toBe('0 USD');
    expect(formatCompactVaultUsd(Number.NaN)).toBe('0 USD');
  });
});

describe('formatExactVaultUsd', () => {
  it('shows one decimal', () => {
    expect(formatExactVaultUsd(363.86)).toBe('$363.9');
    expect(formatExactVaultUsd(-1)).toBe('$0');
  });
});
