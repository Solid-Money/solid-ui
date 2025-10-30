import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import DepositOptionModal from '@/components/DepositOption/ResponsiveDepositOptionModal';
import { buttonVariants } from '@/components/ui/button';
import { useDimension } from '@/hooks/useDimension';

const DepositBanner = () => {
  const { isScreenMedium } = useDimension();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'secondary',
          className: 'h-12 pr-6 rounded-xl border-0',
        })}
      >
        <View className="flex-row items-center gap-4">
          <Plus color="white" />
          <Text className="font-bold">Add funds</Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
      style={{
        borderRadius: 20,
        paddingHorizontal: isScreenMedium ? 40 : 20,
        paddingVertical: isScreenMedium ? 32 : 20,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <View className="flex-1 flex-row justify-between items-center">
        <View className="max-w-56 md:max-w-72 h-full justify-between items-start gap-4">
          <Text className="text-xl md:text-3xl font-semibold">
            Deposit from your bank or debit card
          </Text>
          <DepositOptionModal trigger={getTrigger()} />
        </View>
        <View>
          <Image
            source={require('@/assets/images/fund-wallet-tokens.png')}
            contentFit="contain"
            style={{ width: isScreenMedium ? 175 : 120, height: isScreenMedium ? 175 : 120 }}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export default DepositBanner;
