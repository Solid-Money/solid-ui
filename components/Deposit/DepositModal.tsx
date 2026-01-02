import React from 'react';
import { Pressable, View } from 'react-native';

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

  const triggerElement = <DepositTrigger />;

  // Always wrap with Pressable to ensure click handling works
  // pointerEvents="none" on the inner View ensures the Pressable captures the touch/click
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none">{triggerElement}</View>
    </Pressable>
  );
};

export default DepositModal;
