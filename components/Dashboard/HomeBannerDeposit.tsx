import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

const HomeBannerDeposit = () => {
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  return (
    <LinearGradient
      colors={['rgba(41, 20, 58, 1)', 'rgba(28, 14, 41, 1)']}
      style={{
        borderRadius: 16,
        padding: 16,
        height: 90,
        overflow: 'hidden',
      }}
    >
      <View className="relative h-full flex-row items-center justify-end">
        <Image
          source={require('@/assets/images/solid-purple-large.png')}
          contentFit="contain"
          style={{
            width: 160,
            height: 160,
            position: 'absolute',
            top: -50,
            left: -40,
          }}
        />
        <Text className="max-w-52 font-medium font-semibold leading-tight">
          Deposit your stablecoins and earn{' '}
          {isMaxAPYsLoading ? (
            <Skeleton className="h-4 w-14 bg-purple/50" />
          ) : (
            <Text
              className={cn('font-bold text-brand', {
                underline: Platform.OS === 'web',
              })}
            >
              {maxAPY?.toFixed(2)}%
            </Text>
          )}{' '}
          per year
        </Text>
      </View>
    </LinearGradient>
  );
};

export default HomeBannerDeposit;
