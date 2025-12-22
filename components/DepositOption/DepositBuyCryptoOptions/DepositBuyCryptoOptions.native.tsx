import DepositOption from '@/components/DepositOption/DepositOption';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositBonusConfig } from '@/hooks/useDepositBonusConfig';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

const DepositBuyCryptoOptions = () => {
  const { setModal } = useDepositStore();
  const { isEnabled: isDepositBonusEnabled, percentage } = useDepositBonusConfig();

  const handleBankDepositPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const handleCreditCardPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
  }, [setModal]);

  const bonusBannerText = isDepositBonusEnabled
    ? `${Math.round(percentage * 100)}% bonus on deposits`
    : undefined;

  const buyCryptoOptions = useMemo(
    () => [
      {
        text: 'Debit/Credit Card',
        subtitle: 'Google Pay, card or bank account',
        bannerText: bonusBannerText,
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
        bannerText: bonusBannerText,
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
    [handleCreditCardPress, handleBankDepositPress, bonusBannerText],
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
