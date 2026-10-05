import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Toast from 'react-native-toast-message';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAddress } from 'viem';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import { SEND_MODAL } from '@/constants/modals';
import { addToAddressBook, fetchAddressBook } from '@/lib/api';
import { AddressBookRequest } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';

/**
 * Where a cross-chain send contact receives: the exchange, its network and the
 * token. Saved with the address so the next send can skip the destination and
 * network steps.
 */
const crossChainFields = {
  exchange: z.string().optional(),
  chainId: z.number().optional(),
  token: z.string().optional(),
};

const addressBookSchema = z.object({
  walletAddress: z
    .string()
    .refine(val => val.trim().length > 0, { error: 'Address is required' })
    .refine(val => isAddress(val.trim()), { error: 'Please enter a valid Ethereum address' })
    .transform(val => val.trim()),
  name: z
    .string()
    .min(1, { error: 'Name is required' })
    .transform(val => val.trim()),
  skip2fa: z.boolean().optional(),
  ...crossChainFields,
});

const addressBookSchemaOptionalName = z.object({
  walletAddress: z
    .string()
    .refine(val => val.trim().length > 0, { error: 'Address is required' })
    .refine(val => isAddress(val.trim()), { error: 'Please enter a valid Ethereum address' })
    .transform(val => val.trim()),
  name: z
    .string()
    .transform(val => val.trim())
    .optional(),
  skip2fa: z.boolean().optional(),
  ...crossChainFields,
});

export type AddressBookFormData = z.infer<typeof addressBookSchema>;
export type AddressBookFormDataOptionalName = z.infer<typeof addressBookSchemaOptionalName>;

export const useAddressBook = (options?: {
  defaultAddress?: string;
  defaultName?: string;
  /** Cross-chain send destination to store alongside the address. */
  defaultExchange?: string;
  defaultChainId?: number;
  defaultToken?: string;
  onSuccess?: () => void;
  onError?: () => void;
  optionalName?: boolean;
}) => {
  const setModal = useSendStore(state => state.setModal);
  const queryClient = useQueryClient();

  const { data: addressBook = [] } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
    staleTime: 5 * 60 * 1000, // 5 minutes - address book changes infrequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const addressBookEntry = useMemo(() => {
    if (!options?.defaultAddress) return null;
    return addressBook.find(
      entry => entry.walletAddress.toLowerCase() === options.defaultAddress!.toLowerCase(),
    );
  }, [addressBook, options?.defaultAddress]);

  const hasSkipped2fa = !!addressBookEntry?.skipped2faAt;

  const schema = options?.optionalName ? addressBookSchemaOptionalName : addressBookSchema;
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
  } = useForm<AddressBookFormData | AddressBookFormDataOptionalName>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      walletAddress: options?.defaultAddress || '',
      name: options?.defaultName || '',
      skip2fa: false,
      exchange: options?.defaultExchange,
      chainId: options?.defaultChainId,
      token: options?.defaultToken,
    },
  });

  const addToAddressBookMutation = useMutation({
    mutationFn: (data: AddressBookRequest) => withRefreshToken(() => addToAddressBook(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-book'] });
      if (options?.onSuccess) {
        options.onSuccess();
      } else {
        Toast.show({
          type: 'success',
          text1: 'Added to contacts',
          props: {
            badgeText: 'Success',
          },
        });
        setModal(SEND_MODAL.OPEN_FORM);
      }
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to add to contacts',
        props: {
          badgeText: 'Error',
        },
      });
      if (options?.onError) {
        options.onError();
      }
    },
  });

  const handleAddContact = async (data?: AddressBookFormData | AddressBookFormDataOptionalName) => {
    const formData = data || watch();
    await addToAddressBookMutation.mutateAsync({
      walletAddress: formData.walletAddress,
      name: formData.name,
      skip2fa: formData.skip2fa,
      exchange: formData.exchange,
      chainId: formData.chainId,
      token: formData.token,
    });
  };

  return {
    control,
    handleSubmit,
    errors,
    isValid,
    setValue,
    watch,
    handleAddContact,
    addToAddressBookMutation,
    hasSkipped2fa,
  };
};
