import {
  calculateEstimatedDailyEarnings,
  FALLBACK_VAULT_APY,
  formatVaultApyLabel,
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
  it('includes the percent symbol in the APY label', () => {
    expect(formatVaultApyLabel(4.5)).toBe('4.5% APY');
  });
});
