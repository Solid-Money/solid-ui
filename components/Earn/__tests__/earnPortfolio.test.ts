import {
  calculateEstimatedDailyEarnings,
  formatVaultApyLabel,
  shouldShowEarnVaultCard,
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

describe('shouldShowEarnVaultCard', () => {
  it('shows a vault with positive APY', () => {
    expect(shouldShowEarnVaultCard(4.5, false)).toBe(true);
  });

  it('keeps the vault visible while APY is loading', () => {
    expect(shouldShowEarnVaultCard(0, true)).toBe(true);
  });

  it.each([0, -0.1])('hides a vault with %s APY', apy => {
    expect(shouldShowEarnVaultCard(apy, false)).toBe(false);
  });
});

describe('formatVaultApyLabel', () => {
  it('includes the percent symbol in the APY label', () => {
    expect(formatVaultApyLabel(4.5)).toBe('4.5% APY');
  });
});
