import {
  hasSelectedVaultFunds,
  productBalanceUsd,
} from '@/components/Savings/NewSavings/vaultFunding';
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

  // The EUR vault's balance is in euros, kept apart from the USD values.
  it('reads the EUR vault from its own euro value', () => {
    const withEur = { ...values, [VaultType.EUR]: 40 };
    expect(hasSelectedVaultFunds(withEur, VaultType.EUR)).toBe(true);
    expect(hasSelectedVaultFunds(values, VaultType.EUR)).toBe(false);
  });
});

describe('productBalanceUsd', () => {
  it('counts a production soUSD on a development build once, not twice', () => {
    // $27 of soUSD the savings reads miss: the wallet's by-symbol total already has it.
    expect(productBalanceUsd({ portfolioUsd: 0, unreadUsd: 27, walletUsd: 27 })).toBe(27);
  });

  it('adds shares backing the card, which the wallet total cannot see', () => {
    expect(productBalanceUsd({ portfolioUsd: 2560, vaultReadUsd: 2122.5, walletUsd: 2122.5 })).toBe(
      2560,
    );
    expect(productBalanceUsd({ portfolioUsd: 437.5, unreadUsd: 27, walletUsd: 27 })).toBe(464.5);
  });

  it('falls back to whichever read has the position, and never goes below zero', () => {
    expect(productBalanceUsd({ vaultReadUsd: 100 })).toBe(100);
    expect(productBalanceUsd({ walletUsd: 50 })).toBe(50);
    expect(productBalanceUsd({})).toBe(0);
  });
});
