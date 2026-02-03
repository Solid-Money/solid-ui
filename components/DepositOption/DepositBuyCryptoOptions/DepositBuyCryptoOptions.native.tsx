import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import DepositOption from '@/components/DepositOption/DepositOption';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';

const DepositBuyCryptoOptions = () => {
  const setModal = useDepositStore(state => state.setModal);

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
            source={getAsset('images/buy_crypto.png')}
            style={{ width: 26, height: 22 }}
            contentFit="contain"
          />
        ),
        onPress: handleCreditCardPress,
      },
      {
        text: 'Bank Deposit',
        subtitle: 'Make a transfer from your bank.',
        icon: (
          <Image
            source={getAsset('images/bank_deposit.png')}
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
      {buyCryptoOptions
        .map(option => (
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
