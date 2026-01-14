import React from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { DEPOSIT_FROM_SAFE_ACCOUNT_MODAL } from '@/constants/modals';
import { useDepositFromSafeAccountStore } from '@/store/useDepositFromSafeAccount';

import { DepositTrigger } from '.';

/**
 * DepositModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by DepositFromSafeAccountModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 */
const DepositModal = () => {
  const { setModal } = useDepositFromSafeAccountStore();

  const handlePress = () => {
    setModal(DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.OPEN_FORM);
  };

  return (
    <SlotTrigger onPress={handlePress}>
      <DepositTrigger />
    </SlotTrigger>
  );
};

export default DepositModal;
