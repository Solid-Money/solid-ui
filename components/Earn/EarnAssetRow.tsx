import { Pressable, View } from 'react-native';

import StockLogo from '@/components/Stocks/StockLogo';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

interface EarnAssetRowProps {
  ticker: string;
  name: string;
  sector: string;
  logoUrl?: string;
  /** Undefined until the live USD price lands. */
  price?: number;
  onPress: () => void;
}

const formatPrice = (price: number) =>
  `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One tokenized asset in the Earn "Earn more" list. */
export const EarnAssetRow = ({
  ticker,
  name,
  sector,
  logoUrl,
  price,
  onPress,
}: EarnAssetRowProps) => (
  <Pressable
    accessibilityLabel={`${name}, ${sector}`}
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
        {sector}
      </Text>
    </View>

    {price === undefined ? (
      <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
    ) : (
      <Text className="text-[15px] font-semibold leading-5 text-white">{formatPrice(price)}</Text>
    )}
  </Pressable>
);
