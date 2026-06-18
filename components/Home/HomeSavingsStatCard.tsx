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
          source={getAsset('images/flash-lavender.png')}
          alt="Savings"
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
        <View className="gap-1">
          <Text className="text-base font-medium text-muted-foreground">Savings</Text>
          {isAPYsLoading ? (
            <Skeleton className="h-8 w-20 rounded-xl" />
          ) : (
            <Text
              className="text-foreground"
              style={{
                fontSize: fontSize(1.875),
                fontFamily: 'MonaSans_600SemiBold',
                fontWeight: '600',
              }}
            >
              {formatNumber(maxAPY ?? 0, 1)}%
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default HomeSavingsStatCard;
