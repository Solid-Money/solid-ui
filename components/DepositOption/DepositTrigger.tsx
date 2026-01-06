import { Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useUser from '@/hooks/useUser';
import { DepositModal } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

export interface DepositTriggerProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: DepositModal;
}

/**
 * Trigger component for opening the deposit modal.
 * Does not render any modal/overlay - just the trigger button.
 *
 * The actual modal is rendered by DepositModalProvider at the app root.
 */
const DepositTrigger = ({
  buttonText = 'Add funds',
  trigger,
  modal = DEPOSIT_MODAL.OPEN_OPTIONS,
}: DepositTriggerProps) => {
  const { user } = useUser();
  const { setModal, srcChainId } = useDepositStore();

  const handlePress = () => {
    // Check if user has email when opening deposit modal
    if (user && !user.email) {
      setModal(DEPOSIT_MODAL.OPEN_EMAIL_GATE);
    } else if (srcChainId) {
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    } else {
      setModal(modal);
    }
  };

  // Default trigger button when no custom trigger provided
  const defaultTrigger = (
    <Pressable onPress={handlePress}>
      <View
        className={buttonVariants({
          variant: 'brand',
          className: 'h-12 rounded-xl pr-6',
        })}
      >
        <View className="flex-row items-center gap-1">
          <Plus color="black" />
          <Text className="text-base font-bold text-primary-foreground">{buttonText}</Text>
        </View>
      </View>
    </Pressable>
  );

  if (!trigger) {
    return defaultTrigger;
  }

  return <SlotTrigger onPress={handlePress}>{trigger}</SlotTrigger>;
};

export default DepositTrigger;
