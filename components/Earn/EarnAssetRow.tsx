import { Pressable, View } from 'react-native';

import StockLogo from '@/components/Stocks/StockLogo';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

interface EarnAssetRowProps {
  ticker: string;
  name: string;
  /** Secondary line: the asset's sector when browsing, the holding size when held. */
  caption: string;
  logoUrl?: string;
  /** The unit price when browsing, the position's worth when held. Undefined until it lands. */
  value?: number;
  onPress: () => void;
}

const formatUsd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One tokenized asset row, in either the positions list or the catalog. */
export const EarnAssetRow = ({
  ticker,
  name,
  caption,
  logoUrl,
  value,
  onPress,
}: EarnAssetRowProps) => (
  <Pressable
    accessibilityLabel={`${name}, ${caption}`}
    accessibilityRole="button"
    onPress={onPress}
    className="flex-row items-center gap-3 rounded-2xl py-2.5 transition-all active:opacity-70"
  >
    <StockLogo ticker={ticker} logoColor="#1C1C1C" logoUrl={logoUrl} size={38} />

    <View className="min-w-0 flex-1 gap-0.5">
      <Text className="text-[15px] font-semibold leading-5 text-white" numberOfLines={1}>
        {name}
      </Text>
      <Text className="text-[13px] leading-4 text-white/50" numberOfLines={1}>
        {caption}
      </Text>
    </View>

    {value === undefined ? (
      <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
    ) : (
      <Text className="text-[15px] font-semibold leading-5 text-white">{formatUsd(value)}</Text>
    )}
  </Pressable>
);
