import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_PIN_MODAL } from '@/constants/modals';
import { useCardPinStore } from '@/store/useCardPinStore';

const DefaultTrigger = () => (
  <Button className="h-12 rounded-xl px-6" style={{ backgroundColor: '#303030' }}>
    <Text className="text-base font-bold text-white">Manage PIN</Text>
  </Button>
);

/**
 * ManagePinModal - thin wrapper around trigger components.
 *
 * The actual modal is rendered by ManagePinModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 */
export default function ManagePinModal({ trigger }: { trigger?: React.ReactNode }) {
  const { setModal } = useCardPinStore(
    useShallow(state => ({
      setModal: state.setModal,
    })),
  );

  const handlePress = () => {
    setModal(CARD_PIN_MODAL.OPEN_FORM);
  };

  if (trigger === null) {
    return null;
  }

  return <SlotTrigger onPress={handlePress}>{trigger ?? <DefaultTrigger />}</SlotTrigger>;
}
