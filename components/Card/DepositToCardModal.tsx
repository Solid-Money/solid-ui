import React from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDepositStore } from '@/store/useCardDepositStore';

const DefaultTrigger = () => (
  <Button className="h-12 rounded-xl px-6" style={{ backgroundColor: '#94F27F' }}>
    <Text className="font-bold text-black">Add funds</Text>
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
export default function DepositToCardModal({ trigger }: { trigger?: React.ReactNode }) {
  const { setModal } = useCardDepositStore();

  const handlePress = () => {
    setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  // Headless usage - the global CardDepositModalProvider handles the modal
  if (trigger === null) {
    return null;
  }

  // Use default trigger if not provided
  const triggerElement = trigger ?? <DefaultTrigger />;

  // Always wrap with Pressable to ensure click handling works
  // pointerEvents="none" on the inner View ensures the Pressable captures the touch/click
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none">{triggerElement}</View>
    </Pressable>
  );
}
