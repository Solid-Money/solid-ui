import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTotalAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';

interface StartEarningProps {
  className?: string;
}

const StartEarning = ({ className }: StartEarningProps) => {
  const { isScreenMedium } = useDimension();
  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'purple',
          className: 'w-40 h-12 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-4">
          <Text className="font-bold">Start earning</Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
      style={{
        borderRadius: 20,
        padding: isScreenMedium ? 40 : 20,
      }}
      className={className}
    >
      <View className="flex-col md:flex-row justify-between gap-y-4 h-full">
        <View className="justify-between gap-4">
          <Text className="text-3xl font-semibold max-w-sm">
            Deposit your stablecoins and earn{' '}
            {isTotalAPYLoading ? (
              <Skeleton className="w-24 h-10 bg-purple/50" />
            ) : (
              <Text className="text-3xl text-brand font-bold underline">
                {totalAPY?.toFixed(2)}%
              </Text>
            )}{' '}
            per year
          </Text>
          <DepositOptionModal trigger={getTrigger()} />
        </View>
        <View>
          <Image
            source={require('@/assets/images/solid-purple-large.png')}
            contentFit="contain"
            style={{ width: 233, height: 233, marginLeft: -50 }}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export default StartEarning;
