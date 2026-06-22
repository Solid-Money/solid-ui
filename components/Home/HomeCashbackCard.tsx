import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import CountUp from '@/components/CountUp';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { getAsset } from '@/lib/assets';
import { cn, fontSize } from '@/lib/utils';

interface HomeCashbackCardProps {
  className?: string;
}

// Fixed height for the stat value so the loading skeleton and the loaded amount
// occupy exactly the same vertical space. Without this the card shrinks while the
// amount is loading and grows back once it resolves. Kept in sync with
// HomeSavingsStatCard so the two cards stay the same height in every state.
const STAT_VALUE_HEIGHT = Math.round(fontSize(1.875) * 1.3);

/**
 * Compact "Cashback" stat card. Shows total cashback earned (from card details)
 * and the headline cashback rate. Sits next to the savings card on home.
 */
const HomeCashbackCard = ({ className }: HomeCashbackCardProps) => {
  const router = useRouter();
  const { data: cardDetails, isLoading } = useCardDetails();

  const cashbackUsd = cardDetails?.cashback?.totalUsdValue ?? 0;
  const percentage = cardDetails?.cashback?.percentage ?? 3;

  return (
    <Pressable onPress={() => router.push(path.REWARDS)} className={cn('flex-1', className)}>
      <View className="h-full justify-between gap-6 rounded-twice bg-card p-5">
        <Image
          source={getAsset('images/green-diamond-background.png')}
          alt="Cashback"
          style={{ width: 70, height: 70 }}
          contentFit="contain"
        />
        <View className="gap-1">
          <Text className="text-base font-medium text-muted-foreground">Cashback</Text>
          <View className="flex-row items-end gap-2">
            <View style={{ height: STAT_VALUE_HEIGHT, justifyContent: 'flex-end' }}>
              {isLoading ? (
                <Skeleton className="w-16 rounded-xl" style={{ height: STAT_VALUE_HEIGHT }} />
              ) : (
                <CountUp
                  prefix="$"
                  count={cashbackUsd}
                  isTrailingZero={false}
                  decimalPlaces={cashbackUsd > 0 ? 2 : 0}
                  classNames={{
                    wrapper: 'text-foreground',
                    decimalSeparator: 'text-lg font-semibold',
                  }}
                  styles={{
                    wholeText: {
                      fontSize: fontSize(1.875),
                      lineHeight: STAT_VALUE_HEIGHT,
                      fontWeight: '600',
                      fontFamily: 'MonaSans_600SemiBold',
                      color: '#ffffff',
                    },
                    decimalText: {
                      fontSize: fontSize(1.875),
                      lineHeight: STAT_VALUE_HEIGHT,
                      fontWeight: '600',
                      fontFamily: 'MonaSans_600SemiBold',
                      color: '#ffffff',
                    },
                  }}
                />
              )}
            </View>
            <Text className="mb-1 max-w-[5.5rem] text-xs leading-tight text-muted-foreground">
              Up to {percentage}% Cashback
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default HomeCashbackCard;
