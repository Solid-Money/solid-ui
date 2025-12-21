import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { isAddress } from 'viem';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { addToAddressBook } from '@/lib/api';
import { useSendStore } from '@/store/useSendStore';

const addressBookSchema = z.object({
  walletAddress: z
    .string()
    .refine(val => val.trim().length > 0, 'Address is required')
    .refine(val => isAddress(val.trim()), 'Please enter a valid Ethereum address')
    .transform(val => val.trim()),
  name: z
    .string()
    .min(1, 'Name is required')
    .transform(val => val.trim()),
});

type AddressBookFormData = z.infer<typeof addressBookSchema>;

const AddressBook: React.FC = () => {
  const { address, setModal } = useSendStore();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AddressBookFormData>({
    resolver: zodResolver(addressBookSchema),
    mode: 'onChange',
    defaultValues: {
      walletAddress: address || '',
      name: '',
    },
  });

  const addToAddressBookMutation = useMutation({
    mutationFn: addToAddressBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-book'] });
      Toast.show({
        type: 'success',
        text1: 'Added to address book',
      });
      setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to add to address book',
      });
    },
  });

  const handleAddContact = async (data: AddressBookFormData) => {
    await addToAddressBookMutation.mutateAsync({
      walletAddress: data.walletAddress,
      name: data.name,
    });
  };

  return (
    <View className="gap-8">
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
