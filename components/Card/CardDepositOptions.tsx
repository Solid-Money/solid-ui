import React, { useCallback } from 'react';
import { Platform, View } from 'react-native';
import { ChevronRight, Wallet } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { useCardDepositStore } from '@/store/useCardDepositStore';

export default function CardDepositOptions() {
  const { setModal, setSource } = useCardDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSource: state.setSource,
    })),
  );

  const Item = useCallback(
    ({ text, onPress }: { text: string; onPress: () => void }) => (
      <Button
        variant="ghost"
        className="flex-row items-center justify-between rounded-2xl bg-primary/10 p-6 disabled:opacity-100 disabled:web:hover:opacity-100"
        style={{ height: 78 }}
        onPress={onPress}
      >
        <View className="flex-row items-center gap-3">
          <Wallet color="white" size={24} />
          <Text className="native:text-lg text-lg font-semibold">{text}</Text>
        </View>
        <ChevronRight color="white" size={20} />
      </Button>
    ),
    [],
  );

  const handleInternalOptionPress = useCallback(() => {
    track(TRACKING_EVENTS.CARD_DEPOSIT_OPTION_SELECTED, {
      option: 'internal',
      option_label: 'From Wallet/Savings',
    });
    setSource('wallet');
    setModal(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);
  }, [setSource, setModal]);

  const handleExternalOptionPress = useCallback(() => {
    track(TRACKING_EVENTS.CARD_DEPOSIT_OPTION_SELECTED, {
      option: 'external',
      option_label: 'From External Wallet',
    });
    setSource('external');
    setModal(CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM);
  }, [setSource, setModal]);

  return (
    <View className="gap-y-2.5">
      <Item text="From Wallet/Savings" onPress={handleInternalOptionPress} />
      {Platform.OS === 'web' && (
        <Item text="From External Wallet" onPress={handleExternalOptionPress} />
      )}
    </View>
  );
}
