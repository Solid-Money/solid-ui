import DepositOption from '@/components/DepositOption/DepositOption';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

const DepositBuyCryptoOptions = () => {
  const { setModal } = useDepositStore();

  const handleBankDepositPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const handleCreditCardPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
  }, [setModal]);

  const buyCryptoOptions = useMemo(
    () => [
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
        subtitle: 'Make a transfer from your bank.',
        bannerText: '5% bonus on deposits',
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
    ],
    [handleCreditCardPress, handleBankDepositPress],
  );

  return (
    <View className="gap-y-2.5">
      {buyCryptoOptions.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
          isComingSoon={option.isComingSoon}
          bannerText={option.bannerText}
        />
      ))}
    </View>
  );
};

export default DepositBuyCryptoOptions;
