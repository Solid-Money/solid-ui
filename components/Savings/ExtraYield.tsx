import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import TooltipPopover from '@/components/Tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

const ExtraYield = () => {
  const { isScreenMedium } = useDimension();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="font-bold">Start earning</Text>
        </View>
      </View>
    );
  };

  const getImage = () => {
    return (
      <Image
        source={require('@/assets/images/three-percent.png')}
        style={{ width: 146, height: 146 }}
        contentFit="contain"
      />
    );
  };

  return (
    <View className="md:flex-1 bg-card rounded-twice p-5 md:p-8 md:flex-row md:items-center justify-between gap-4">
      <View className="md:items-start gap-4">
        {isScreenMedium ? null : getImage()}
        <Text className="text-2xl leading-6 font-bold md:max-w-72">
          Get extra 3% for your early support!
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-muted-foreground font-medium">Get +3% APY for 2 months.</Text>
          <TooltipPopover text="Deposit $100+ and earn an extra 3% APY for 2 months." />
        </View>
        <DepositOptionModal trigger={getTrigger()} />
      </View>

      {isScreenMedium ? getImage() : null}
    </View>
  );
};

export default ExtraYield;
