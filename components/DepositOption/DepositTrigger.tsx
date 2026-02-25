import React from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import SlotTrigger from '@/components/SlotTrigger';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { DepositModal } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

export interface DepositTriggerProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: DepositModal;
  source?: string; // Track where the deposit trigger was clicked from (e.g., 'home_banner', 'nav_button', 'activity_page')
  preserveSelectedVault?: boolean; // When true, keeps the currently selected vault. When false (default), resets to USDC (vault 0).
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
  source = 'unknown',
  preserveSelectedVault = false,
}: DepositTriggerProps) => {
  const { user } = useUser();
  const { setModal, setSrcChainId } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSrcChainId: state.setSrcChainId,
    })),
  );

  const handlePress = () => {
    if (!preserveSelectedVault) {
      useSavingStore.getState().selectVaultForDeposit(0);
    }
    setSrcChainId(0); // reset chain so modal always opens to options
    const modalToOpen = user && !user.email ? DEPOSIT_MODAL.OPEN_EMAIL_GATE : modal;

    track(TRACKING_EVENTS.DEPOSIT_TRIGGER_CLICKED, {
      source,
      button_text: buttonText,
      has_email: !!user?.email,
      has_src_chain: false,
      modal_to_open: modalToOpen,
    });

    if (user && !user.email) {
      setModal(DEPOSIT_MODAL.OPEN_EMAIL_GATE);
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
