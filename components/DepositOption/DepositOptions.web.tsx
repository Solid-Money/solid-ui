import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useActiveAccount } from 'thirdweb/react';
import DepositOption from './DepositOption';

const DepositOptions = () => {
  const activeAccount = useActiveAccount();
  const { setModal } = useDepositStore();
  const { user } = useUser();
  const address = activeAccount?.address;

  // Track when deposit options are viewed
  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_OPTIONS_VIEWED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      has_wallet_connected: !!address,
      is_first_deposit: !user?.isDeposited,
    });
  }, [user?.userId, user?.safeAddress, user?.isDeposited, address]);

  const handleExternalWalletPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'external_wallet',
    });
    setModal(DEPOSIT_MODAL.OPEN_EXTERNAL_WALLET_OPTIONS);
  }, [setModal]);

  const handleBuyCryptoPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
    });
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS);
  }, [setModal]);

  const handlePublicAddressPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'public_address',
    });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  }, [setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: 'Deposit from external wallet',
      subtitle: 'Transfer from any crypto wallet\nor exchange',
      icon: (
        <Image
          source={require('@/assets/images/deposit_from_external_wallet.png')}
          style={{ width: 28, height: 12 }}
          contentFit="contain"
        />
      ),
      onPress: handleExternalWalletPress,
    },
    {
      text: 'Buy crypto',
      subtitle: 'Google Pay, card or bank account',
      icon: (
        <Image
          source={require('@/assets/images/buy_crypto.png')}
          style={{ width: 22, height: 17 }}
          contentFit="contain"
        />
      ),
      onPress: handleBuyCryptoPress,
    },
    {
      text: 'Public address',
      subtitle: 'Receive crypto directly to your wallet',
      icon: (
        <Image
          source={require('@/assets/images/public_address.png')}
          style={{ width: 26, height: 26 }}
          contentFit="contain"
        />
      ),
      onPress: handlePublicAddressPress,
    },
  ];

  return (
    <View className="gap-y-2.5">
      {DEPOSIT_OPTIONS.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
        />
      ))}
    </View>
  );
};

export default DepositOptions;
