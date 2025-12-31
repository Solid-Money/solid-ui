import { Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

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
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-1">
          <Plus color="black" />
          <Text className="text-primary-foreground font-bold text-base">{buttonText}</Text>
        </View>
      </View>
    </Pressable>
  );

  if (!trigger) {
    return defaultTrigger;
  }

  // Always wrap with Pressable to ensure click handling works
  // pointerEvents="none" on the inner View ensures the Pressable captures the touch/click
  return (
    <Pressable onPress={handlePress}>
      <View pointerEvents="none">{trigger}</View>
    </Pressable>
  );
};

export default DepositTrigger;
