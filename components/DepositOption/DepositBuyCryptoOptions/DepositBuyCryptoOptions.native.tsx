import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import DepositOption from '@/components/DepositOption/DepositOption';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDepositBonusConfig } from '@/hooks/useCardDepositBonusConfig';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { getAsset } from '@/lib/assets';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const DepositBuyCryptoOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { isEnabled: isDepositBonusEnabled, percentage } = useCardDepositBonusConfig();
  const { depositConfig } = useVaultDepositConfig();

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
            source={getAsset('images/buy_crypto.png')}
            style={{ width: 26, height: 22 }}
            contentFit="contain"
          />
        ),
        onPress: handleCreditCardPress,
        method: 'credit_card' as DepositMethod,
      },
      {
        text: 'Bank Deposit',
        subtitle: 'Make a transfer from your bank.',
        bannerText: bonusBannerText,
        icon: (
          <Image
            source={getAsset('images/bank_deposit.png')}
            style={{ width: 26, height: 22 }}
            contentFit="contain"
          />
        ),
        onPress: handleBankDepositPress,
        isComingSoon: false,
        method: 'bank_transfer' as DepositMethod,
      },
    ],
    [handleCreditCardPress, handleBankDepositPress, bonusBannerText],
  );

  return (
    <View className="gap-y-2.5">
      {buyCryptoOptions
        .filter(option => !option.method || depositConfig.methods.includes(option.method))
        .map(option => (
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
