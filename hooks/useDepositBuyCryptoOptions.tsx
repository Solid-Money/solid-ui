import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { DepositMethod, RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import { useDimension } from './useDimension';

const useDepositBuyCryptoOptions = () => {
  const router = useRouter();
  const setModal = useDepositStore(state => state.setModal);
  const { isScreenMedium } = useDimension();
  const { data: cardStatus } = useCardStatus();

  const handleBankDepositPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
    });

    const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;

    if (!isRainApproved) {
      setModal(DEPOSIT_MODAL.CLOSE);
      router.push(path.KYC);
      return;
    }

    setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
  }, [cardStatus?.rainApplicationStatus, router, setModal]);

  const buyCryptoOptions = useMemo(
    () => [
      {
        text: 'Bank Deposit',
        subtitle: isScreenMedium
          ? 'Wire or ACH from your bank.\nFunds arrive as USDC.'
          : 'Wire or ACH from your bank. Funds arrive as USDC.',
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
    [handleBankDepositPress, isScreenMedium],
  );

  const filteredOptions =
    Platform.OS === 'ios'
      ? buyCryptoOptions.filter(option => option.method !== 'credit_card')
      : buyCryptoOptions;

  return { buyCryptoOptions: filteredOptions };
};

export default useDepositBuyCryptoOptions;
