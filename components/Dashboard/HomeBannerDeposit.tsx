import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTotalAPY } from '@/hooks/useAnalytics';
import { Skeleton } from '@/components/ui/skeleton';

const HomeBannerDeposit = () => {
  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY();

  return (
    <LinearGradient
      colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
      style={{
        borderRadius: 20,
        padding: 20,
      }}
    >
      <View className="relative flex-row justify-end gap-4">
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
        <Text className="font-semibold max-w-52">
          Deposit your stablecoins and earn{' '}
          {isTotalAPYLoading ? (
            <Skeleton className="w-14 h-4 bg-purple/50" />
          ) : (
            <Text className="text-brand font-bold underline">{totalAPY?.toFixed(2)}%</Text>
          )}{' '}
          per year
        </Text>
      </View>
    </LinearGradient>
  );
};

export default HomeBannerDeposit;
