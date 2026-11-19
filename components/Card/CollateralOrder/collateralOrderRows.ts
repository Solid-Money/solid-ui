import { formatUnits } from 'viem';

import {
  COLLATERAL_LABEL,
  type CollateralIcon,
  formatLtv,
} from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { type CollateralAssetKey, collateralAssetKeyOf } from '@/lib/utils/collateralOrder';

import type { CardCreditPositions, CreditCollateralAsset } from '@/hooks/useCardCreditPositions';

/** One collateral on the Collateral order screen: every holding of it, on Fuse and Base together. */
export interface CollateralOrderRow {
  key: CollateralAssetKey;
  icon: CollateralIcon;
  /** "USD Yield", "Bitcoin": as the Credit panel names it. */
  name: string;
  /** "LTV 90%", as the Credit panel shows it; "LTV 85–90%" when the instances differ. */
  subtitle?: string;
  /** "$230.00", or "€70.00" for a euro asset. */
  value: string;
  /** "≈ $81.60" under a euro value; absent for a dollar one. */
  detail?: string;
}

const WAD = 10n ** 18n;

/** Always two decimals, as the Credit panel's rows are drawn. */
const formatMoney = (amount: bigint, currency: 'USD' | 'EUR'): string =>
  Number(formatUnits(amount, 6)).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const percentOf = (ltvWad: bigint): string => {
  const percent = Number((ltvWad * 1000n) / WAD) / 10;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
};

/**
 * The LTV line for one key across its holdings: the one figure when every instance agrees (the
 * Credit panel's own "LTV 90%"), the range when Fuse and Base set it apart.
 */
const ltvOf = (holdings: readonly CreditCollateralAsset[]): string | undefined => {
  const set = holdings.map(asset => asset.ltvWad).filter(ltv => ltv > 0n);
  if (!set.length) return undefined;
  const low = set.reduce((min, ltv) => (ltv < min ? ltv : min));
  const high = set.reduce((max, ltv) => (ltv > max ? ltv : max));
  return low === high ? formatLtv(low) : `LTV ${percentOf(low)}–${percentOf(high)}%`;
};

/**
 * One row per collateral the card can lock, held or not, keyed by collateral key.
 *
 * Built from what each instance's module accepts as collateral, so a key is listed only where the
 * card can actually lock it: a Fuse-only card lists USD Yield alone. soUSD on Fuse and on Base are
 * one row with their values added up, since the order ranks the asset and not the network. A euro
 * asset reads in euros with its dollar value under it, when every holding of it is priced in
 * euros; otherwise in dollars.
 */
export const buildCollateralOrderRows = (
  positions: CardCreditPositions | undefined,
): Map<CollateralAssetKey, CollateralOrderRow> => {
  // Only what the card can lock: a token taken off the collateral list is not ordered.
  const accepted = [
    ...(positions?.fuse?.collateral ?? []),
    ...(positions?.base?.collateral ?? []),
  ].filter(asset => asset.listedAsCollateral);
  const byKey = new Map<CollateralAssetKey, CreditCollateralAsset[]>();
  for (const asset of accepted) {
    const key = collateralAssetKeyOf(asset.symbol);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), asset]);
  }

  const rows = new Map<CollateralAssetKey, CollateralOrderRow>();
  for (const [key, holdings] of byKey) {
    const named = COLLATERAL_LABEL[holdings[0].symbol];
    const usd = holdings.reduce((sum, asset) => sum + asset.valueUsd, 0n);
    const inEuros = holdings.every(asset => asset.valueEur !== undefined);
    const eur = holdings.reduce((sum, asset) => sum + (asset.valueEur ?? 0n), 0n);
    rows.set(key, {
      key,
      icon: named?.icon ?? (inEuros ? 'eur' : 'usd'),
      name: named?.label ?? holdings[0].symbol,
      subtitle: ltvOf(holdings),
      value: inEuros ? formatMoney(eur, 'EUR') : formatMoney(usd, 'USD'),
      detail: inEuros ? `≈ ${formatMoney(usd, 'USD')}` : undefined,
    });
  }
  return rows;
};
