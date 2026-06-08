import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useIsTestUser } from '@/hooks/useIsTestUser';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { DepositMethod, RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const useDepositBuyCryptoOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: cardStatus } = useCardStatus();
  const isTestUser = useIsTestUser();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);

  const handleBankDepositPress = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
    });

    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      return;
    }

    // No automation yet — show the Apply intro. The intro CTA decides whether
    // to send the user through KYC or straight to the ToS modal based on their
    // current Rain approval status.
    setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_APPLY);
  }, [existingAutomation, setModal]);

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

  const filteredOptions = buyCryptoOptions
    // Bank Deposit is gated behind the test-features allow list for now.
    .filter(option => option.method !== 'bank_transfer' || isTestUser)
    .filter(option => Platform.OS !== 'ios' || option.method !== 'credit_card');

  return { buyCryptoOptions: filteredOptions };
};

export default useDepositBuyCryptoOptions;
