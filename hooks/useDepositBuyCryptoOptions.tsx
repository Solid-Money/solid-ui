import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDepositBonusConfig } from '@/hooks/useDepositBonusConfig';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';

const useDepositBuyCryptoOptions = () => {
  const { setModal } = useDepositStore();
  const { isEnabled: isDepositBonusEnabled, percentage } = useDepositBonusConfig();

  const handleBankDepositPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
      bonus_banner_visible: isDepositBonusEnabled,
    });
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal, isDepositBonusEnabled]);

  const handleCreditCardPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'credit_card',
      bonus_banner_visible: isDepositBonusEnabled,
    });
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
  }, [setModal, isDepositBonusEnabled]);

  const bonusBannerText = isDepositBonusEnabled
    ? `${Math.round(percentage * 100)}% bonus on deposits`
    : undefined;

  const buyCryptoOptions = useMemo(
    () => [
      {
        text: 'Debit/Credit Card',
        subtitle: 'Apple pay, Google Pay, or your\ncredit card',
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
        subtitle: 'Make a transfer from your bank',
        bannerText: bonusBannerText,
        icon: (
          <Image
            source={require('@/assets/images/bank_deposit.png')}
            style={{ width: 26, height: 22 }}
            contentFit="contain"
          />
        ),
        onPress: handleBankDepositPress,
      },
    ],
    [handleCreditCardPress, handleBankDepositPress, bonusBannerText],
  );

  return { buyCryptoOptions };
};

export default useDepositBuyCryptoOptions;
