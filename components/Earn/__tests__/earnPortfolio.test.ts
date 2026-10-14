import {
  calculateEstimatedDailyEarnings,
  FALLBACK_VAULT_APY,
  formatVaultApyLabel,
  resolveVaultApy,
  type UsdVaultAmounts,
  type VaultApys,
} from '@/components/Earn/earnPortfolio';
import { VaultType } from '@/lib/types';

describe('calculateEstimatedDailyEarnings', () => {
  it('weights each vault APY by its USD value', () => {
    const values: UsdVaultAmounts = {
      [VaultType.USDC]: 1_000,
      [VaultType.ETH]: 2_000,
      [VaultType.FUSE]: 500,
    };
    const apys: VaultApys = {
      [VaultType.USDC]: 3.65,
      [VaultType.ETH]: 7.3,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: undefined,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBeCloseTo(0.5, 8);
  });

  it('does not allow invalid negative balances or APYs to reduce the estimate', () => {
    const values: UsdVaultAmounts = {
      [VaultType.USDC]: -1_000,
      [VaultType.ETH]: 1_000,
      [VaultType.FUSE]: 0,
    };
    const apys: VaultApys = {
      [VaultType.USDC]: 10,
      [VaultType.ETH]: -5,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: undefined,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBe(0);
  });

  // soEURC is held in EUR: even with a rate, a euro balance never enters "+$… today".
  it('never adds the EUR vault into the dollar estimate', () => {
    const values: UsdVaultAmounts = { [VaultType.EUR]: 36_500 };
    const apys: VaultApys = {
      [VaultType.USDC]: 0,
      [VaultType.ETH]: 0,
      [VaultType.FUSE]: 0,
      [VaultType.EUR]: 10,
    };

    expect(calculateEstimatedDailyEarnings(values, apys)).toBe(0);
  });
});

describe('resolveVaultApy', () => {
  it('prefers the reported APY when the analytics API returns one', () => {
    expect(resolveVaultApy(VaultType.USDC, 5.2)).toBe(5.2);
    expect(resolveVaultApy(VaultType.EUR, 1.5)).toBe(1.5);
  });

  it.each([
    [VaultType.USDC, 4],
    [VaultType.ETH, 2],
    [VaultType.FUSE, 14],
  ])('falls back to the indicative rate for %s', (vaultType, expected) => {
    expect(resolveVaultApy(vaultType, 0)).toBe(expected);
    expect(resolveVaultApy(vaultType, undefined)).toBe(expected);
  });

  // The EUR vault does not earn yet: no invented rate, so its tile reads "—".
  it('has no fallback rate for the EUR vault', () => {
    expect(FALLBACK_VAULT_APY[VaultType.EUR]).toBeUndefined();
    expect(resolveVaultApy(VaultType.EUR, 0)).toBeUndefined();
    expect(resolveVaultApy(VaultType.EUR, undefined)).toBeUndefined();
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

  it('shows a dash, not 0%, for a vault with no rate', () => {
    expect(formatVaultApyLabel(undefined)).toBe('— APY');
  });
});
