import React from 'react';
import { Controller } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { useAddressBook } from '@/hooks/useAddressBook';
import { useSendStore } from '@/store/useSendStore';

const AddressBook: React.FC = () => {
  const address = useSendStore(state => state.address);
  const recipientModal = useSendStore(state => state.recipientModal);
  const returnToRecipients = recipientModal.name === SEND_MODAL.OPEN_SEND_OPTIONS.name;

  const { control, handleSubmit, errors, isValid, handleAddContact, addToAddressBookMutation } =
    useAddressBook({
      defaultAddress: address || '',
      defaultName: '',
      onSuccess: returnToRecipients
        ? () => {
            const state = useSendStore.getState();
            state.setAddress('');
            state.setName('');
            state.setSearchQuery('');
            state.setModal(recipientModal);
            Toast.show({ type: 'success', text1: 'Added to contacts' });
          }
        : undefined,
    });

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="min-h-[17rem] flex-1 gap-8">
        <View className="gap-4">
          <Text className="text-base font-medium opacity-70">Address</Text>
          <View className="flex-row items-center gap-2 rounded-2xl bg-card p-5">
            <Controller
              control={control}
              name="walletAddress"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="flex-1 text-base text-white web:focus:outline-none"
                  placeholder="Address"
                  placeholderTextColor="#ffffff80"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            />
          </View>
          {errors.walletAddress && (
            <Text className="text-sm text-red-500">{errors.walletAddress.message}</Text>
          )}
        </View>

        <View className="gap-4">
          <Text className="text-base font-medium opacity-70">Contact name</Text>
          <View className="flex-row items-center gap-2 rounded-2xl bg-card p-5">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="flex-1 text-base text-white web:focus:outline-none"
                  placeholderTextColor="#ffffff80"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            />
          </View>
          {errors.name && <Text className="text-sm text-red-500">{errors.name.message}</Text>}
        </View>
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-xl"
        onPress={handleSubmit(handleAddContact)}
        disabled={!isValid || addToAddressBookMutation.isPending}
      >
        <Text className="text-base font-bold">
          {addToAddressBookMutation.isPending ? 'Adding Contact' : 'Add Contact'}
        </Text>
      </Button>
    </View>
  );
};

export default AddressBook;
