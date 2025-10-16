import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { View } from 'react-native';
import DepositOption from './DepositOption';

const DepositBuyCryptoOptions = () => {
  const { setModal } = useDepositStore();

  const handleBankDepositPress = useCallback(async () => {
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const handleCreditCardPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
  }, [setModal]);

  const BUY_CRYPTO_OPTIONS = [
    {
      text: 'Debit/Credit Card',
      subtitle: 'Google Pay, card or bank account',
      icon: (
        <Image
          source={require('@/assets/images/buy_crypto.png')}
          style={{ width: 26, height: 22 }}
          contentFit="contain"
        />
      ),
      onPress: handleCreditCardPress,
    },
    {
      text: 'Bank Deposit',
      icon: (
        <Image
          source={require('@/assets/images/bank_deposit.png')}
          style={{ width: 26, height: 22 }}
          contentFit="contain"
        />
      ),
      onPress: handleBankDepositPress,
      isComingSoon: false,
    },
  ];

  return (
    <View className="gap-y-2.5">
      {BUY_CRYPTO_OPTIONS.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
          isComingSoon={option.isComingSoon}
        />
      ))}
    </View>
  );
};

export default DepositBuyCryptoOptions;
