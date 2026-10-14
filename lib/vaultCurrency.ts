import { VaultType } from '@/lib/types';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';

/**
 * The currency a savings vault is shown in.
 *
 * Every vault is valued in USD except soEURC, which is held and shown in EUR and is
 * never converted into a USD total — not the home headline, not
 * `useTotalSavingsUSD`, not the portfolio. Adding it would need a live EUR/USD
 * rate, and one that failed or went stale would silently mis-state the most
 * important number on screen; `balanceTotals.ts` keeps the Wirex EUR balance out
 * of the headline for the same reason.
 *
 * A leaf module (no `lib/utils` barrel, no assets) so pure tests can import it.
 */
export type VaultCurrency = 'USD' | 'EUR';

/** The vault types valued in USD — the only ones that may enter a USD total. */
export type UsdVaultType = Exclude<VaultType, VaultType.EUR>;

export const isEurVault = (vaultType: VaultType | undefined): vaultType is VaultType.EUR =>
  vaultType === VaultType.EUR;

export const USD_VAULT_TYPES: UsdVaultType[] = Object.values(VaultType).filter(
  (vaultType): vaultType is UsdVaultType => !isEurVault(vaultType),
);

export const getVaultCurrency = (vaultType: VaultType | undefined): VaultCurrency =>
  isEurVault(vaultType) ? 'EUR' : 'USD';

/** `€` for soEURC, `$` for every other vault. */
export const getVaultCurrencySymbol = (vaultType: VaultType | undefined): string =>
  CURRENCY_SYMBOLS[getVaultCurrency(vaultType)];

/**
 * A vault amount with its currency symbol: `€1,234.56`, `$1,234.56`, `-€5.00`.
 * The digits follow `formatNumber`: the minimum only applies from 1 upwards, so
 * dust reads `€0.004` rather than `€0.00`.
 */
export const formatVaultAmount = (
  value: number,
  vaultType: VaultType | undefined,
  maximumFractionDigits = 2,
  minimumFractionDigits = 2,
): string => {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  const abs = Math.abs(safe);
  const max = Math.max(0, Math.min(20, maximumFractionDigits));
  const min = Math.min(abs >= 1 ? Math.max(0, minimumFractionDigits) : 0, max);
  const digits = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: max,
    minimumFractionDigits: min,
  }).format(abs);
  return `${safe < 0 ? '-' : ''}${getVaultCurrencySymbol(vaultType)}${digits}`;
};
