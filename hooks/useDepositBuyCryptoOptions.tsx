import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { DepositMethod, RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

const useDepositBuyCryptoOptions = () => {
  const router = useRouter();
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const { data: cardStatus } = useCardStatus();
  useEffect(() => {
    console.warn(cardStatus);
  }, [cardStatus]);
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);

  const handleBankDepositPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
    });

    if (!isRainApproved) {
      setKycFlow('va');
      setModal(DEPOSIT_MODAL.CLOSE);
      router.push(path.KYC);
      return;
    }

    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      return;
    }

    setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
  }, [existingAutomation, isRainApproved, router, setKycFlow, setModal]);

  const buyCryptoOptions = useMemo(
    () => [
      {
        text: 'Bank Deposit',
        subtitle: 'Wire or ACH from your bank.',
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
    [handleBankDepositPress],
  );

  const filteredOptions =
    Platform.OS === 'ios'
      ? buyCryptoOptions.filter(option => option.method !== 'credit_card')
      : buyCryptoOptions;

  return { buyCryptoOptions: filteredOptions };
};

export default useDepositBuyCryptoOptions;
