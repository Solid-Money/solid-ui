import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { eclipseAddress } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';

import Plus from '@/assets/images/Plus';

interface AddAddressProps {
  address: string;
}

const AddAddress: React.FC<AddAddressProps> = ({ address }) => {
  const { setAddress, setModal } = useSendStore();

  const handlePress = () => {
    setAddress(address);
    setModal(SEND_MODAL.OPEN_FORM);
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
