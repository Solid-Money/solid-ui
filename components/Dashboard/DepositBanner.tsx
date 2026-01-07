import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';
import SwipeableBanner from './SwipeableBanner';

const DepositBanner = () => {
  const { isScreenMedium } = useDimension();
  const { setModal } = useDepositStore();

  const handleAddFundsPress = () => {
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS);
  };

  const getButton = () => {
    return (
      <Button
        variant="secondary"
        className="h-12 gap-4 rounded-xl border-0 pr-6"
        onPress={handleAddFundsPress}
      >
        <Plus color="white" />
        <Text className="font-bold">Add funds</Text>
      </Button>
    );
  };

  const getTrigger = () => {
    return (
      <SwipeableBanner onPress={() => setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS)}>
        <LinearGradient
          colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
          style={{
            borderRadius: 20,
            flex: 1,
            width: '100%',
            overflow: 'hidden',
          }}
        >
          <View className="flex-1 flex-row items-center justify-between px-5 py-5 md:px-10 md:py-8">
            <View className="h-full max-w-52 items-start justify-between gap-4 md:max-w-72">
              <Text className="text-xl font-semibold md:text-3xl">
                Deposit from your bank or debit card
              </Text>
              {getButton()}
            </View>
            <View className="pointer-events-none">
              <Image
                source={getAsset('images/fund-wallet-tokens.png')}
                contentFit="contain"
                style={{ width: isScreenMedium ? 156 : 130, height: isScreenMedium ? 156 : 130 }}
              />
            </View>
          </View>
        </LinearGradient>
      </SwipeableBanner>
    );
  };

  return (
    <>
      {getTrigger()}
      <DepositOptionModal trigger={null} modal={DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS} />
    </>
  );
};

export default DepositBanner;
