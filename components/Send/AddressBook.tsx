import React from 'react';
import { Controller } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAddressBook } from '@/hooks/useAddressBook';
import { useSendStore } from '@/store/useSendStore';

const AddressBook: React.FC = () => {
  const { address } = useSendStore();

  const { control, handleSubmit, errors, isValid, handleAddContact, addToAddressBookMutation } =
    useAddressBook({
      defaultAddress: address || '',
      defaultName: '',
    });

  return (
    <View className="gap-8">
      <View className="gap-8 min-h-[30rem]">
        <View className="gap-4">
          <Text className="text-base opacity-70 font-medium">To</Text>
          <View className="flex-row items-center gap-2 bg-card rounded-2xl p-5">
            <Controller
              control={control}
              name="walletAddress"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="text-white text-base web:focus:outline-none flex-1"
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
          <Text className="text-base opacity-70 font-medium">Name</Text>
          <View className="flex-row items-center gap-2 bg-card rounded-2xl p-5">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="text-white text-base web:focus:outline-none flex-1"
                  placeholder="Full name"
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
