import React from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';
import { DepositModal } from '@/lib/types';

export interface DepositTriggerProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: DepositModal;
  source?: string; // Track where the deposit trigger was clicked from (e.g., 'home_banner', 'nav_button', 'activity_page')
  preserveSelectedVault?: boolean; // When true, keeps the currently selected vault. When false (default), resets to USDC (vault 0).
  onBeforeOpen?: () => void; // Called before opening the modal, e.g. to set depositFromSolid
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
  modal = DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE,
  source = 'unknown',
  preserveSelectedVault = false,
  onBeforeOpen,
}: DepositTriggerProps) => {
  const openDepositFlow = useOpenDepositFlow();

  const handlePress = () => {
    onBeforeOpen?.();
    openDepositFlow({ modal, source, buttonText, preserveSelectedVault });
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
