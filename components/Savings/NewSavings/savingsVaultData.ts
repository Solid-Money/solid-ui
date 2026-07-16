import { VAULTS } from '@/constants/vaults';
import { VaultType } from '@/lib/types';

import type { AssetPath } from '@/lib/assets';

/** Per-vault max APY + loading flag, keyed by VaultType. */
export type ApyByType = Record<VaultType, { maxAPY: number; isAPYsLoading: boolean }>;

/** Friendly display names for the redesigned savings UI (mockup wording). */
const DISPLAY_NAMES: Record<VaultType, string> = {
  [VaultType.USDC]: 'USDC',
  [VaultType.FUSE]: 'Fuse',
  [VaultType.ETH]: 'Ethereum',
};

export type SavingsVaultDisplay = {
  type: VaultType;
  name: string;
  icon: AssetPath;
  index: number;
};

/** Ordered list [USDC, FUSE, ETH] with display name + icon, for the vault rows. */
export const SAVINGS_VAULTS: SavingsVaultDisplay[] = VAULTS.map((vault, index) => ({
  type: vault.type,
  name: DISPLAY_NAMES[vault.type] ?? vault.name,
  icon: vault.icon,
  index,
}));

export const getVaultDisplay = (type: VaultType): SavingsVaultDisplay =>
  SAVINGS_VAULTS.find(vault => vault.type === type) ?? SAVINGS_VAULTS[0];

/** APY formatted for display, e.g. "6.5% APY". Falls back to "—% APY" while loading. */
export const formatApyLabel = (apy: number | undefined, isLoading: boolean) => {
  if (isLoading || apy === undefined) return '—';
  return `${apy.toFixed(1)}%`;
};
