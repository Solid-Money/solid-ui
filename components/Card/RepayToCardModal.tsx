import React, { useCallback } from 'react';
import { View } from 'react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_REPAY_MODAL } from '@/constants/modals';
import { useCardRepayStore } from '@/store/useCardRepayStore';

/**
 * RepayToCardModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by CardRepayModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global CardRepayModalProvider handles the modal state.
 */
export default function RepayToCardModal({ trigger }: { trigger?: React.ReactNode }) {
  const setModal = useCardRepayStore(state => state.setModal);

  const handlePress = useCallback(() => {
    setModal(CARD_REPAY_MODAL.OPEN_FORM);
  }, [setModal]);

  if (trigger === null) {
    return null;
  }

  if (trigger) {
    return <SlotTrigger onPress={handlePress}>{trigger}</SlotTrigger>;
  }

  return (
    <Button
      variant="secondary"
      className="h-12 rounded-xl border-0 bg-[#303030] px-6"
      onPress={handlePress}
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-bold text-white">Repay</Text>
      </View>
    </Button>
  );
}
