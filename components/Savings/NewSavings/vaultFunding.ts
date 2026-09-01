import { VaultType } from '@/lib/types';

type VaultValues = Partial<Record<VaultType, number>> | undefined;

/** A portfolio can be funded while the vault being viewed is still empty. */
export const hasSelectedVaultFunds = (
  valuesByVault: VaultValues,
  vaultType: VaultType,
  hasWalletPosition = false,
) => Math.max(valuesByVault?.[vaultType] ?? 0, 0) > 0 || hasWalletPosition;
