import {
  calculateEstimatedDailyEarnings,
  FALLBACK_VAULT_APY,
  formatVaultApyLabel,
  interestOverPastDays,
  resolveVaultApy,
  type VaultAmounts,
} from '@/components/Earn/earnPortfolio';
import { VaultType } from '@/lib/types';

describe('calculateEstimatedDailyEarnings', () => {
  it('weights each vault APY by its USD value', () => {
    const values: VaultAmounts = {
      [VaultType.USDC]: 1_000,
      [VaultType.ETH]: 2_000,
      [VaultType.FUSE]: 500,
    };
    const apys: VaultAmounts = {
      [VaultType.USDC]: 3.65,
      [VaultType.ETH]: 7.3,
      [VaultType.FUSE]: 0,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBeCloseTo(0.5, 8);
  });

  it('does not allow invalid negative balances or APYs to reduce the estimate', () => {
    const values: VaultAmounts = {
      [VaultType.USDC]: -1_000,
      [VaultType.ETH]: 1_000,
      [VaultType.FUSE]: 0,
    };
    const apys: VaultAmounts = {
      [VaultType.USDC]: 10,
      [VaultType.ETH]: -5,
      [VaultType.FUSE]: 0,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBe(0);
  });
});

describe('resolveVaultApy', () => {
  it('prefers the reported APY when the analytics API returns one', () => {
    expect(resolveVaultApy(VaultType.USDC, 5.2)).toBe(5.2);
  });

  it.each([
    [VaultType.USDC, 4],
    [VaultType.ETH, 2],
    [VaultType.FUSE, 14],
  ])('falls back to the indicative rate for %s', (vaultType, expected) => {
    expect(resolveVaultApy(vaultType, 0)).toBe(expected);
    expect(resolveVaultApy(vaultType, undefined)).toBe(expected);
  });

  it('falls back rather than showing a negative APY', () => {
    expect(resolveVaultApy(VaultType.ETH, -0.8)).toBe(FALLBACK_VAULT_APY[VaultType.ETH]);
  });
});

describe('formatVaultApyLabel', () => {
  it('renders one decimal place, matching the vault tile design', () => {
    expect(formatVaultApyLabel(4.5)).toBe('4.5% APY');
    expect(formatVaultApyLabel(4)).toBe('4.0% APY');
  });
});

describe('interestOverPastDays', () => {
  it('reads 30 days of share-price growth back out of the 30-day APY', () => {
    // $2,560 at 4.5% a year: about $9.24 over 30 days.
    expect(interestOverPastDays(2560, 4.5)).toBeCloseTo(9.24, 2);
    expect(interestOverPastDays(27, 4.5)).toBeCloseTo(0.098, 2);
  });

  it('never claims more than was earned since the first deposit', () => {
    // Deposited a week ago: only a week of interest exists.
    expect(interestOverPastDays(2560, 4.5, 30, 2.1)).toBe(2.1);
    expect(interestOverPastDays(2560, 4.5, 30, 0)).toBe(0);
  });

  it('is zero without a balance or a rate', () => {
    expect(interestOverPastDays(0, 4.5)).toBe(0);
    expect(interestOverPastDays(2560, undefined)).toBe(0);
    expect(interestOverPastDays(2560, 0)).toBe(0);
    expect(interestOverPastDays(2560, Number.NaN)).toBe(0);
  });
});
