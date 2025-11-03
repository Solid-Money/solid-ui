import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { buttonVariants } from '@/components/ui/button';
import { useDimension } from '@/hooks/useDimension';
import { DEPOSIT_MODAL } from '@/constants/modals';

const DepositBanner = () => {
  const { isScreenMedium } = useDimension();

  const getButton = () => {
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

  const getTrigger = () => {
    return (
      <LinearGradient
        colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
        style={{
          borderRadius: 20,
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          paddingHorizontal: isScreenMedium ? 40 : 20,
          paddingVertical: isScreenMedium ? 32 : 20,
        }}
      >
        <View className="flex-row justify-between items-center">
          <View className="max-w-52 md:max-w-72 h-full justify-between items-start gap-4">
            <Text className="text-xl md:text-3xl font-semibold">
              Deposit from your bank or debit card
            </Text>
            {getButton()}
          </View>
          <View>
            <Image
              source={require('@/assets/images/fund-wallet-tokens.png')}
              contentFit="contain"
              style={{ width: isScreenMedium ? 156 : 130, height: isScreenMedium ? 156 : 130 }}
            />
          </View>
        </View>
      </LinearGradient>
    );
  };

  return (
    <DepositOptionModal trigger={getTrigger()} modal={DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS} />
  );
};

export default DepositBanner;
