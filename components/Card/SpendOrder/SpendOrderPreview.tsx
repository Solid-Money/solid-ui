import { StyleSheet, View } from 'react-native';

import {
  isPreviewYieldKey,
  previewAssetColor,
  previewAssetLabel,
} from '@/components/Card/OrderList/previewAssets';
import PreviewShopChips from '@/components/Card/OrderList/PreviewShopChips';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  SPEND_ORDER_PREVIEW_PURCHASE,
  type SpendOrderPreviewShop,
  useSpendOrderPreview,
} from '@/hooks/useSpendOrder';

import type { CardSpendOrderPreviewLine, CardSpendOrderPreviewResponse } from '@/lib/types';
import type { SpendOrderPreference } from '@/lib/utils/spendOrder';

const money = (amount: number, currency: 'USD' | 'EUR'): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "$10" for a whole amount, "$10.50" otherwise: the footnote's short form. */
const shortMoney = (amount: number, currency: 'USD' | 'EUR'): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const headline = (shop: SpendOrderPreviewShop): string => {
  const { amount } = SPEND_ORDER_PREVIEW_PURCHASE[shop];
  if (shop === 'EUR') return `A ${shortMoney(amount, 'EUR')} purchase would use`;
  if (shop === 'OTHER')
    return `A ${shortMoney(amount, 'USD')} purchase in another currency would use`;
  return `A ${shortMoney(amount, 'USD')} purchase would use`;
};

/**
 * The line under the breakdown: what the cardholder would want to know about this split. A
 * shortfall first, then a 1:1 euro debit, then a yield share drawn only in part.
 */
const footnote = (
  preview: CardSpendOrderPreviewResponse,
  shop: SpendOrderPreviewShop,
): string | undefined => {
  if (!preview.covered) {
    const short = Number(preview.shortfall_usd);
    return short > 0
      ? `Your balance can’t cover this purchase. It’s ${money(short, 'USD')} short.`
      : 'Your balance can’t cover this purchase.';
  }
  if (preview.one_to_one) return 'Paid 1:1 from your euros, so there’s no FX fee.';

  const share = preview.lines.find(line => isPreviewYieldKey(line.asset));
  if (!share) return undefined;
  const inEuros = shop === 'EUR' && share.amount_eur !== undefined;
  const amount = inEuros ? Number(share.amount_eur) : Number(share.amount_usd);
  return `Only the ${shortMoney(amount, inEuros ? 'EUR' : 'USD')} this purchase needs leaves ${previewAssetLabel(share.asset)}. The rest keeps earning.`;
};

/**
 * The card bonus's line: it pays before any balance, and the backend's `lines` are the Safe's share
 * of the rest, so without it the breakdown would not add up to the purchase.
 */
const CARD_BONUS_LINE = 'CARD_BONUS';
const CARD_BONUS_COLOR = '#FFFFFF';

const lineLabel = (asset: string): string =>
  asset === CARD_BONUS_LINE ? 'Card bonus' : previewAssetLabel(asset);
const lineColor = (asset: string): string =>
  asset === CARD_BONUS_LINE ? CARD_BONUS_COLOR : previewAssetColor(asset);

/** The lines to draw: the card bonus first when it pays, then the balances, only non-zero ones. */
const previewLines = (preview: CardSpendOrderPreviewResponse): CardSpendOrderPreviewLine[] => {
  const lines = preview.lines.filter(line => Number(line.amount_usd) > 0);
  const bonus = preview.card_credit_usd;
  return bonus !== undefined && Number(bonus) > 0
    ? [{ asset: CARD_BONUS_LINE, amount_usd: bonus }, ...lines]
    : lines;
};

interface SpendOrderPreviewProps {
  draft: SpendOrderPreference;
  shop: SpendOrderPreviewShop;
  onShopChange: (shop: SpendOrderPreviewShop) => void;
}

/**
 * The Preview panel (Figma 30971:15315, 30972:15305): how a purchase at each kind of shop would be
 * paid under the order on screen, saved or not. The split is the backend's own selection, so it is
 * never one the card would not make.
 */
const SpendOrderPreview = ({ draft, shop, onShopChange }: SpendOrderPreviewProps) => {
  const { data: preview, isPending, isError } = useSpendOrderPreview(draft, shop);
  const lines = preview ? previewLines(preview) : [];
  const total = lines.reduce((sum, line) => sum + Number(line.amount_usd), 0);
  const note = preview ? footnote(preview, shop) : undefined;

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
                    backgroundColor: lineColor(line.asset),
                    flex: total > 0 ? Number(line.amount_usd) / total : 1,
                    height: 8,
                  }}
                />
              ))}
            </View>
          ) : null}
          {lines.length ? (
            <View style={styles.breakdown}>
              {lines.map(line => {
                const inEuros = shop === 'EUR' && line.amount_eur !== undefined;
                return (
                  <View key={line.asset} style={styles.line}>
                    <View style={[styles.dot, { backgroundColor: lineColor(line.asset) }]} />
                    <Text className="flex-1 text-[16px] font-normal leading-[20px] text-white/70">
                      {lineLabel(line.asset)}
                    </Text>
                    <Text className="text-right text-[16px] font-medium leading-[20px] text-white">
                      {inEuros
                        ? money(Number(line.amount_eur), 'EUR')
                        : money(Number(line.amount_usd), 'USD')}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {note ? (
            <Text className="text-[14px] font-normal leading-[18px] text-white/50">{note}</Text>
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
  line: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  dot: { borderRadius: 4, height: 8, width: 8 },
});

export default SpendOrderPreview;
