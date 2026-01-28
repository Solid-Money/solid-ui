import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDepositStore } from '@/store/useCardDepositStore';

const DefaultTrigger = () => (
  <Button className="h-12 rounded-xl px-6" style={{ backgroundColor: '#94F27F' }}>
    <Text className="text-base font-bold text-black">Add funds</Text>
  </Button>
);

/**
 * DepositToCardModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by CardDepositModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global CardDepositModalProvider handles the modal state.
 */
export default function DepositToCardModal({
  trigger,
  initialSource,
}: {
  trigger?: React.ReactNode;
  initialSource?: 'wallet' | 'savings' | 'external' | 'borrow';
}) {
  const { setModal, setSource } = useCardDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSource: state.setSource,
    })),
  );

  const handlePress = () => {
    setSource((initialSource as any) || 'wallet');
    setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
  };

  if (trigger === null) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{trigger ?? <DefaultTrigger />}</SlotTrigger>;
}
