import { useCallback, useMemo } from 'react';
import { Image } from 'expo-image';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const useDepositBuyCryptoOptions = () => {
  const setModal = useDepositStore(state => state.setModal);

  const handleBankDepositPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
    });
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const handleCreditCardPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'credit_card',
    });
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
  }, [setModal]);

  const buyCryptoOptions = useMemo(
    () => [
      {
        text: 'Debit/Credit Card',
        subtitle: 'Apple pay, Google Pay, or your\ncredit card',
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
        subtitle: 'Make a transfer from your bank',
        chipText: 'Cheapest',
        icon: (
          <Image
            source={getAsset('images/bank_deposit.png')}
            style={{ width: 26, height: 22 }}
            contentFit="contain"
          />
        ),
        onPress: handleBankDepositPress,
        method: 'bank_transfer' as DepositMethod,
      },
    ],
    [handleCreditCardPress, handleBankDepositPress],
  );

  return { buyCryptoOptions };
};

export default useDepositBuyCryptoOptions;
