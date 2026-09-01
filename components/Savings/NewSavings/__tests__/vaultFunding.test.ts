import { hasSelectedVaultFunds } from '@/components/Savings/NewSavings/vaultFunding';
import { VaultType } from '@/lib/types';

describe('hasSelectedVaultFunds', () => {
  const values = {
    [VaultType.USDC]: 0,
    [VaultType.FUSE]: 125,
    [VaultType.ETH]: 0,
  };

  it('shows the funded card only for the selected vault that owns the balance', () => {
    expect(hasSelectedVaultFunds(values, VaultType.USDC)).toBe(false);
    expect(hasSelectedVaultFunds(values, VaultType.FUSE)).toBe(true);
    expect(hasSelectedVaultFunds(values, VaultType.ETH)).toBe(false);
  });

  it('treats missing, zero, and negative values as unfunded', () => {
    expect(hasSelectedVaultFunds(undefined, VaultType.USDC)).toBe(false);
    expect(hasSelectedVaultFunds({ [VaultType.USDC]: 0 }, VaultType.USDC)).toBe(false);
    expect(hasSelectedVaultFunds({ [VaultType.USDC]: -10 }, VaultType.USDC)).toBe(false);
  });

  it('uses a wallet-discovered position when the direct vault read misses it', () => {
    expect(hasSelectedVaultFunds(undefined, VaultType.USDC, true)).toBe(true);
    expect(hasSelectedVaultFunds({ [VaultType.USDC]: 0 }, VaultType.USDC, true)).toBe(true);
  });
});
