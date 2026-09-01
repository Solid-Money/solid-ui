import {
  calculateEstimatedDailyEarnings,
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
