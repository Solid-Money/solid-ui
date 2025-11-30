import { useCallback, useMemo } from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';

import HomeQR from '@/assets/images/home-qr';

const useDepositExternalWalletOptionsNative = () => {
  const { setModal } = useDepositStore();

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });

    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

  const externalWalletOptions = useMemo(
    () => [
      {
        text: 'Share your deposit address',
        subtitle:
          'Send supported assets to your solid\ndeposit address from any supported\nnetwork',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
      },
    ],
    [handleDepositDirectly],
  );

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptionsNative;