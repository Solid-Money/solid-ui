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
import { CASHBACK_PENDING_TEXT_COLOR } from '@/lib/cashbackProgress';
import { cn, formatBalanceUSD, formatNumber } from '@/lib/utils';

interface HomeCashbackCardProps {
  className?: string;
}

/**
 * Compact "Cashback" stat card. Shows total cashback earned (from card details)
 * and the headline cashback rate. Sits next to the savings card on home.
 *
 * The total only counts cashback that has been paid, and an escrow takes days
 * to mature — so a purchase made this morning is reported on the pending line
 * rather than silently missing from the figure above it.
 */
const HomeCashbackCard = ({ className }: HomeCashbackCardProps) => {
  const router = useRouter();
  const { data: cardDetails, isLoading } = useCardDetails();

  const cashbackUsd = cardDetails?.cashback?.totalUsdValue ?? 0;
  const pendingUsd = cardDetails?.cashback?.monthlyPendingUsdValue;
  const showPending = pendingUsd !== undefined && pendingUsd > 0;
  const rawPercentage = cardDetails?.cashback?.percentage;
  const percentage =
    rawPercentage == null ? 3 : rawPercentage <= 1 ? rawPercentage * 100 : rawPercentage;
  const formattedPercentage = formatNumber(percentage, 2, 0);
  const showSkeleton = isLoading && !cardDetails;

  return (
    <Pressable onPress={() => router.push(path.REWARDS)} className={cn('flex-1', className)}>
      {/* `flex-1` so the pending line, which the savings card has no equivalent
          of, makes both cards taller together rather than leaving this one
          standing proud of its neighbour. */}
      <View
        className="flex-1 gap-3 overflow-hidden rounded-twice bg-card p-5"
        style={{ minHeight: 188 }}
      >
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
          {/* No skeleton guard needed: nothing is pending until the card
              details land, which is also what clears the skeleton. */}
          {showPending && (
            <Text
              className="text-xs font-medium leading-tight"
              style={{ color: CASHBACK_PENDING_TEXT_COLOR }}
              numberOfLines={1}
            >
              +{formatBalanceUSD(pendingUsd)} pending
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default HomeCashbackCard;
