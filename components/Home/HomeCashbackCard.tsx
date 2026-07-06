import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import CountUp from '@/components/CountUp';
import { HOME_STAT_VALUE_TEXT_STYLE } from '@/components/Home/homeStatValueStyle';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { getAsset } from '@/lib/assets';
import { cn, formatNumber } from '@/lib/utils';

interface HomeCashbackCardProps {
  className?: string;
}

/**
 * Compact "Cashback" stat card. Shows total cashback earned (from card details)
 * and the headline cashback rate. Sits next to the savings card on home.
 */
const HomeCashbackCard = ({ className }: HomeCashbackCardProps) => {
  const router = useRouter();
  const { data: cardDetails, isLoading } = useCardDetails();

  const cashbackUsd = cardDetails?.cashback?.totalUsdValue ?? 0;
  const rawPercentage = cardDetails?.cashback?.percentage;
  const percentage =
    rawPercentage == null ? 3 : rawPercentage <= 1 ? rawPercentage * 100 : rawPercentage;
  const formattedPercentage = formatNumber(percentage, 2, 0);
  const showSkeleton = isLoading && !cardDetails;

  return (
    <Pressable onPress={() => router.push(path.POINTS)} className={cn('flex-1', className)}>
      <View className="gap-3 overflow-hidden rounded-twice bg-card p-5" style={{ minHeight: 188 }}>
        <Image
          source={getAsset('images/green-diamond-background.png')}
          alt="Cashback"
          style={{ width: 84, height: 84 }}
          contentFit="contain"
        />
        <View className="gap-1">
          <Text className="text-base font-medium text-muted-foreground">Cashback</Text>
          <View
            className="flex-row items-end justify-between gap-1"
            style={{ minHeight: HOME_STAT_VALUE_TEXT_STYLE.lineHeight }}
          >
            {showSkeleton ? (
              <>
                <Skeleton className="h-8 w-14 rounded-xl" />
                <View className="mb-1 ml-auto w-16 items-end gap-1 pr-1">
                  <Skeleton className="h-3 w-10 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </View>
              </>
            ) : (
              <>
                <CountUp
                  prefix="$"
                  count={cashbackUsd}
                  isTrailingZero={false}
                  decimalPlaces={cashbackUsd > 0 ? 2 : 0}
                  classNames={{
                    wrapper: 'shrink-0 text-foreground',
                  }}
                  styles={{
                    wholeText: HOME_STAT_VALUE_TEXT_STYLE,
                    decimalText: HOME_STAT_VALUE_TEXT_STYLE,
                    decimalSeparator: HOME_STAT_VALUE_TEXT_STYLE,
                  }}
                />
                <Text
                  className="mb-1 ml-auto min-w-0 max-w-[4.75rem] shrink text-right text-xs leading-tight text-muted-foreground"
                  numberOfLines={2}
                >
                  Up to {formattedPercentage}% Cashback
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default HomeCashbackCard;
