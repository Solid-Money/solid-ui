import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import SlotTrigger from '@/components/SlotTrigger';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

/**
 * WithdrawToCardModal - trigger component that opens the card withdraw modal.
 * The modal is rendered by CardWithdrawModalProvider at the app root.
 */
export default function WithdrawToCardModal({ trigger }: { trigger?: React.ReactNode }) {
  const setModal = useCardWithdrawStore(useShallow(state => state.setModal));

  const handlePress = () => {
    setModal(CARD_WITHDRAW_MODAL.OPEN_FORM);
  };

  if (trigger === null) return null;

  return <SlotTrigger onPress={handlePress}>{trigger}</SlotTrigger>;
}
