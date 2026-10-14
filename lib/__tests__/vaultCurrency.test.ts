import { VaultType } from '@/lib/types';
import {
  formatCurrencyAmount,
  formatVaultAmount,
  getVaultCurrency,
  getVaultCurrencySymbol,
  isEurVault,
  USD_VAULT_TYPES,
} from '@/lib/vaultCurrency';

describe('vault currency', () => {
  it('shows soEURC in euros and every other vault in dollars', () => {
    expect(getVaultCurrency(VaultType.EUR)).toBe('EUR');
    expect(getVaultCurrencySymbol(VaultType.EUR)).toBe('€');
    for (const type of [VaultType.USDC, VaultType.FUSE, VaultType.ETH, undefined]) {
      expect(getVaultCurrency(type)).toBe('USD');
      expect(getVaultCurrencySymbol(type)).toBe('$');
    }
  });

  // The list every USD total is built from: soEURC must never be on it.
  it('never counts the EUR vault among the USD-valued vaults', () => {
    expect(USD_VAULT_TYPES).not.toContain(VaultType.EUR);
    expect([...USD_VAULT_TYPES].sort()).toEqual(
      [VaultType.USDC, VaultType.FUSE, VaultType.ETH].sort(),
    );
    expect(isEurVault(VaultType.EUR)).toBe(true);
    expect(isEurVault(VaultType.USDC)).toBe(false);
  });

  it('formats amounts with the vault currency symbol', () => {
    expect(formatVaultAmount(1234.5, VaultType.EUR)).toBe('€1,234.50');
    expect(formatVaultAmount(1234.5, VaultType.USDC)).toBe('$1,234.50');
    expect(formatVaultAmount(-5, VaultType.EUR)).toBe('-€5.00');
    expect(formatVaultAmount(0.004, VaultType.EUR, 3)).toBe('€0.004');
    expect(formatVaultAmount(Number.NaN, VaultType.EUR)).toBe('€0');
    expect(formatCurrencyAmount(10, 'EUR', 2, 0)).toBe('€10');
  });
});
