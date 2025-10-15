import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAPYs } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

const HomeBannerDeposit = () => {
  const { data: apys, isLoading: isAPYsLoading } = useAPYs();

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
      <View className="relative flex-row justify-end items-center h-full">
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
        <Text className="font-semibold max-w-52 leading-tight font-medium">
          Deposit your stablecoins and earn{' '}
          {isAPYsLoading ? (
            <Skeleton className="w-14 h-4 bg-purple/50" />
          ) : (
            <Text
              className={cn('text-brand font-bold', {
                underline: Platform.OS === 'web',
              })}
            >
              {apys?.thirtyDay?.toFixed(2)}%
            </Text>
          )}{' '}
          per year
        </Text>
      </View>
    </LinearGradient>
  );
};

export default HomeBannerDeposit;
