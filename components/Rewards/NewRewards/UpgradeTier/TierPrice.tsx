import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatUsd } from '@/lib/tierUpgrade';

interface TierPriceProps {
  /** What is paid now — the first year's price, `offerFirstYearFeeUsd`. */
  priceUsd: number | null;
  /** The regular price, struck through beside `priceUsd` when it is higher: the annual fee. */
  listPriceUsd?: number | null;
  /** The smaller grey line under the price, as `TierDetailRow` draws it. */
  secondaryValue?: string;
  /** How each figure is written. "$799.00" by default, as every upgrade card writes money. */
  format?: (amount: number) => string;
}

/**
 * A membership price, with the regular one struck through beside it during a
 * sale: ~~$999.00~~ $799.00.
 *
 * One component so the offer, the review and the bridged review cannot each
 * decide differently what a sale looks like. Drawn as the value of a
 * `TierDetailRow` (pass it as the row's children); the strikethrough appears
 * only when the list price is actually higher, compared in cents.
 */
const TierPrice = ({
  priceUsd,
  listPriceUsd,
  secondaryValue,
  format = formatUsd,
}: TierPriceProps) => {
  const onSale =
    priceUsd !== null &&
    listPriceUsd !== null &&
    listPriceUsd !== undefined &&
    Math.round(priceUsd * 100) < Math.round(listPriceUsd * 100);

  return (
    <View className="ml-4 flex-1 items-end">
      <View className="flex-row flex-wrap items-baseline justify-end gap-x-2">
        {onSale ? (
          <Text
            accessibilityLabel={`Regular price ${format(listPriceUsd!)}`}
            className="text-right text-[14px] leading-6 text-white/40"
            style={styles.struck}
          >
            {format(listPriceUsd!)}
          </Text>
        ) : null}
        <Text className="text-right text-[16px] font-semibold leading-6 text-white">
          {priceUsd === null ? '' : format(priceUsd)}
        </Text>
      </View>
      {secondaryValue ? (
        <Text className="mt-0.5 text-right text-[13px] leading-4 text-white/50">
          {secondaryValue}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // In the style rather than a class: the decoration is the one thing here that
  // has to survive on every platform, and the colour stays in the class so the
  // two layers never disagree about it (see `upgradeRouteLabelClass`).
  struck: { textDecorationLine: 'line-through' },
});

export default TierPrice;
