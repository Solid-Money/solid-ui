import React from 'react';
import { Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import Plus from '@/assets/images/Plus';
import { Text } from '@/components/ui/text';
import { eclipseAddress } from '@/lib/utils';
import { recipientNextModal, useSendStore } from '@/store/useSendStore';

interface AddAddressProps {
  address: string;
}

const AddAddress: React.FC<AddAddressProps> = ({ address }) => {
  const { setAddress, setModal } = useSendStore(
    useShallow(state => ({
      setAddress: state.setAddress,
      setModal: state.setModal,
    })),
  );

  const handlePress = () => {
    setAddress(address);
    setModal(recipientNextModal());
  };

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl bg-card p-4"
      onPress={handlePress}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-foreground/10">
        <Plus />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold">New wallet address</Text>
        <Text className="text-sm opacity-50">{eclipseAddress(address)}</Text>
      </View>
    </Pressable>
  );
};

export default AddAddress;
