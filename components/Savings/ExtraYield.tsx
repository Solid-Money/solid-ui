import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import TooltipPopover from '@/components/Tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTotalAPY } from '@/hooks/useAnalytics';

const ExtraYield = () => {
  const { data: totalAPY } = useTotalAPY();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl bg-[#3D3D3D]',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="font-semibold">Start earning</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="bg-card rounded-twice px-4 py-6 md:px-10 md:py-8 md:flex-row md:items-center justify-between gap-4">
      <View className="md:flex-row md:items-center gap-4">
        <Image
          source={require('@/assets/images/three-percent.png')}
          style={{ width: 70, height: 70 }}
          contentFit="contain"
        />
        <View>
          <Text className="text-2xl font-medium pb-[5px]">Get extra 3% for your early support!</Text>
          <Text className="text-muted-foreground font-medium">
            Get +3% APY for 2 months.{' '}
            <Link
              href="https://docs.solid.xyz"
              target="_blank"
              className="font-bold hover:opacity-70"
            >
              {'Read more >'}
            </Link>
          </Text>
        </View>
      </View>

      <View>
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Pool cap</Text>
          <TooltipPopover text="Pool cap" />
        </View>
        <Text className="text-2xl font-semibold">1M$</Text>
      </View>

      <View>
        <View className="flex-row items-center gap-1">
          <Text className="text-lg text-muted-foreground font-medium">Pool APY</Text>
          <TooltipPopover text="Pool APY" />
        </View>
        <Text className="text-2xl font-semibold">
          {totalAPY ? `${totalAPY.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
        </Text>
      </View>

      <DepositOptionModal trigger={getTrigger()} />
    </View>
  );
};

export default ExtraYield;
