import { collateralAssetKeyOf } from '@/lib/utils/collateralOrder';

import type { CollateralCatalogAsset, CreditCollateralAsset } from '@/hooks/useCardCreditPositions';

export const collateralDiscoveryKey = (asset: CollateralCatalogAsset): string =>
  collateralAssetKeyOf(asset.symbol, asset.chainId) ??
  `${asset.chainId}:${asset.token.toLowerCase()}`;

/** One recommendation per asset, using the first eligible instance in the given order. */
export const findAdditionalCollateral = (
  assets: readonly CreditCollateralAsset[],
): CreditCollateralAsset[] => {
  const listed = new Set(assets.filter(asset => asset.amount > 0n).map(collateralDiscoveryKey));

  return assets.filter(asset => {
    if (!asset.listedAsCollateral || !asset.countsTowardPower || asset.ltvWad <= 0n) return false;
    const key = collateralDiscoveryKey(asset);
    if (listed.has(key)) return false;
    listed.add(key);
    return true;
  });
};
