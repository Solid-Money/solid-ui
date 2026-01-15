import React from 'react';
import { View } from 'react-native';
import { Minus } from 'lucide-react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { UnstakeModal as UnstakeModalType } from '@/lib/types';
import { useUnstakeStore } from '@/store/useUnstakeStore';

type UnstakeModalProps = {
  trigger?: React.ReactNode;
  buttonText?: string;
  modal?: UnstakeModalType;
};

/**
 * Default trigger component for opening the unstake modal.
 */
const DefaultUnstakeTrigger = ({ buttonText = 'Withdraw' }: { buttonText?: string }) => (
  <View
    className={buttonVariants({
      variant: 'secondary',
      className: 'h-12 rounded-xl border-0 bg-[#303030] px-6',
    })}
  >
    <View className="flex-row items-center gap-2">
      <Minus size={20} color="white" />
      <Text className="text-base font-bold text-white">{buttonText}</Text>
    </View>
  </View>
);

/**
 * UnstakeModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by UnstakeModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global UnstakeModalProvider handles the modal state.
 */
const UnstakeModal = ({
  trigger,
  buttonText = 'Withdraw',
  modal = UNSTAKE_MODAL.OPEN_OPTIONS,
}: UnstakeModalProps) => {
  const setModal = useUnstakeStore(state => state.setModal);

  const handlePress = () => {
    setModal(modal);
  };

  if (trigger === null) {
    return null;
  }

  return (
    <SlotTrigger onPress={handlePress}>
      {trigger || <DefaultUnstakeTrigger buttonText={buttonText} />}
    </SlotTrigger>
  );
};

export default UnstakeModal;
