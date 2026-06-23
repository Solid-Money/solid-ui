import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { getAsset } from '@/lib/assets';
import { cn, fontSize, formatNumber } from '@/lib/utils';

interface HomeSavingsStatCardProps {
  className?: string;
}

// Fixed height for the stat value so the loading skeleton and the loaded APY occupy
// the same vertical space. Kept in sync with HomeCashbackCard so the two cards stay
// the same height in every state (loading and loaded).
const STAT_VALUE_HEIGHT = Math.round(fontSize(1.875) * 1.3);

/**
 * Compact "Savings" stat card showing the headline savings APY.
 * Sits next to the cashback card on home and links to the savings screen.
 */
const HomeSavingsStatCard = ({ className }: HomeSavingsStatCardProps) => {
  const router = useRouter();
  const { maxAPY, isAPYsLoading } = useMaxAPY();

  return (
    <Pressable onPress={() => router.push(path.SAVINGS)} className={cn('flex-1', className)}>
      <View className="h-full justify-between gap-6 rounded-twice bg-card p-5">
        <Image
          source={getAsset('images/flash-lavender-background.png')}
          alt="Savings"
          style={{ width: 70, height: 70 }}
          contentFit="contain"
        />
        <View className="gap-1">
          <Text className="text-base font-medium text-muted-foreground">Savings</Text>
          <View style={{ height: STAT_VALUE_HEIGHT, justifyContent: 'flex-end' }}>
            {isAPYsLoading ? (
              <Skeleton className="w-20 rounded-xl" style={{ height: STAT_VALUE_HEIGHT }} />
            ) : (
              <Text
                className="text-foreground"
                style={{
                  fontSize: fontSize(1.875),
                  lineHeight: STAT_VALUE_HEIGHT,
                  fontFamily: 'MonaSans_600SemiBold',
                  fontWeight: '600',
                }}
              >
                {formatNumber(maxAPY ?? 0, 1)}%
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default HomeSavingsStatCard;
