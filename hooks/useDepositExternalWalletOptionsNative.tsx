import { useCallback, useMemo } from 'react';

import HomeQR from '@/assets/images/home-qr';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const useDepositExternalWalletOptionsNative = () => {
  const setModal = useDepositStore(state => state.setModal);

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });

    // Show user's Safe address directly — no backend session needed
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  }, [setModal]);

  const externalWalletOptions = useMemo(
    () => [
      {
        text: 'Share your deposit address',
        subtitle: 'Send supported tokens to your solid deposit address from any supported network',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
        method: 'deposit_directly' as DepositMethod,
      },
    ],
    [handleDepositDirectly],
  );

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptionsNative;
