import { StyleSheet, View } from 'react-native';

import { previewAssetColor, previewAssetLabel } from '@/components/Card/OrderList/previewAssets';
import PreviewShopChips from '@/components/Card/OrderList/PreviewShopChips';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  COLLATERAL_ORDER_PREVIEW_PURCHASE,
  type CollateralOrderPreviewShop,
  useCollateralOrderPreview,
} from '@/hooks/useCollateralOrder';

import { collateralPreviewFootnote, formatLockedAmount } from './collateralPreview';

import type { CollateralAssetKey } from '@/lib/utils/collateralOrder';

const money = (amount: number): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "$150" or "€50": the headline's short form. */
const shortMoney = (amount: number, currency: 'USD' | 'EUR'): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const headline = (shop: CollateralOrderPreviewShop): string => {
  const { amount } = COLLATERAL_ORDER_PREVIEW_PURCHASE[shop];
  if (shop === 'EUR') return `A ${shortMoney(amount, 'EUR')} purchase would lock`;
  if (shop === 'OTHER')
    return `A ${shortMoney(amount, 'USD')} purchase in another currency would lock`;
  return `A ${shortMoney(amount, 'USD')} purchase would lock`;
};

interface CollateralOrderPreviewProps {
  draft: readonly CollateralAssetKey[];
  shop: CollateralOrderPreviewShop;
  onShopChange: (shop: CollateralOrderPreviewShop) => void;
}

/**
 * The Preview panel of the Collateral order screen: what a purchase at each kind of shop would
 * newly lock under the order on screen, saved or not. The backend simulates it with the contract's
 * own lock math, so it never shows a lock the card would not make.
 */
const CollateralOrderPreview = ({ draft, shop, onShopChange }: CollateralOrderPreviewProps) => {
  const { data: preview, isPending, isError } = useCollateralOrderPreview(draft, shop);
  // A purchase credit can't take declines and locks nothing, so only the shortfall is shown.
  const lines = preview?.covered ? preview.lines.filter(line => Number(line.locked_usd) > 0) : [];
  const total = lines.reduce((sum, line) => sum + Number(line.locked_usd), 0);

  return (
    <View style={styles.panel}>
      <PreviewShopChips shop={shop} onShopChange={onShopChange} />

      <Text className="text-[16px] font-medium leading-[20px] text-white">{headline(shop)}</Text>

      {isPending ? (
        <>
          <Skeleton className="h-2 w-full rounded" />
          <Skeleton className="h-5 w-2/3 rounded-md" />
        </>
      ) : isError && !preview ? (
        <Text className="text-[14px] font-normal leading-[18px] text-white/50">
          The preview isn’t available right now. Your order still saves.
        </Text>
      ) : (
        <>
          {lines.length ? (
            <View style={styles.bar}>
              {lines.map(line => (
                <View
                  key={line.asset}
                  style={{
                    backgroundColor: previewAssetColor(line.asset),
                    flex: total > 0 ? Number(line.locked_usd) / total : 1,
                    height: 8,
                  }}
                />
              ))}
            </View>
          ) : null}
          {lines.length ? (
            <View style={styles.breakdown}>
              {lines.map(line => (
                <View key={line.asset} style={styles.line}>
                  <View style={[styles.dot, { backgroundColor: previewAssetColor(line.asset) }]} />
                  <Text className="flex-1 text-[16px] font-normal leading-[20px] text-white/70">
                    {previewAssetLabel(line.asset)}
                  </Text>
                  <View style={styles.amounts}>
                    <Text className="text-right text-[16px] font-medium leading-[20px] text-white">
                      {money(Number(line.locked_usd))}
                    </Text>
                    {line.locked_amount ? (
                      <Text className="text-right text-[14px] font-normal leading-[18px] text-white/50">
                        {formatLockedAmount(line.locked_amount)} {line.symbol}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {preview ? (
            <Text className="text-[14px] font-normal leading-[18px] text-white/50">
              {collateralPreviewFootnote(preview)}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B2B2B', borderRadius: 20, gap: 16, padding: 20 },
  bar: { borderRadius: 4, flexDirection: 'row', gap: 2, overflow: 'hidden' },
  breakdown: { gap: 10 },
  // The dot sits on the first line when a token amount takes a second.
  line: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  dot: { borderRadius: 4, height: 8, marginTop: 6, width: 8 },
  amounts: { alignItems: 'flex-end', gap: 2 },
});

export default CollateralOrderPreview;
