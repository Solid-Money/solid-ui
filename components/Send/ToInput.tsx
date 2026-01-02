import { useQuery } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { isAddress } from 'viem';

import Avatar from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { fetchAddressBook } from '@/lib/api';
import { cn, eclipseAddress, withRefreshToken } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';

interface ToInputProps {
  placeholder?: string;
}

const ToInput: React.FC<ToInputProps> = ({ placeholder = 'Address or name' }) => {
  const {
    address,
    name,
    searchQuery,
    currentModal,
    setAddress,
    setModal,
    setName,
    setSearchQuery,
  } = useSendStore();
  const { data: addressBook = [] } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
  });

  const prevNameRef = useRef(name);
  const prevAddressRef = useRef(address);

  // Sync searchQuery only when name/address changes from empty to set (not when user clears input)
  useEffect(() => {
    const nameChanged = name !== prevNameRef.current;
    const addressChanged = address !== prevAddressRef.current;

    if ((nameChanged || addressChanged) && (name || address) && !searchQuery) {
      setSearchQuery(name || address);
    }

    prevNameRef.current = name;
    prevAddressRef.current = address;
  }, [name, address, searchQuery, setSearchQuery]);

  const isSearch = currentModal.name === SEND_MODAL.OPEN_SEND_SEARCH.name;

  const isValidAddress = useMemo(() => {
    return searchQuery.trim() && isAddress(searchQuery.trim());
  }, [searchQuery]);

  const getValidEntry = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return addressBook.find(
      entry => entry.name?.toLowerCase() === query || entry.walletAddress.toLowerCase() === query,
    );
  }, [searchQuery, addressBook]);

  const isValidName = useMemo(() => {
    if (!searchQuery.trim()) return false;
    return !!getValidEntry?.name;
  }, [searchQuery, getValidEntry?.name]);

  const isValid = isValidAddress || isValidName;

  const handleContinue = () => {
    if (isValidName) {
      const entry = getValidEntry;
      if (entry) {
        setAddress(entry.walletAddress);
        setName(entry.name || '');
        setSearchQuery(entry.name || entry.walletAddress);
        setModal(SEND_MODAL.OPEN_FORM);
      }
    } else if (isValidAddress) {
      const trimmedQuery = searchQuery.trim();
      setAddress(trimmedQuery);
      setName('');
      setSearchQuery(trimmedQuery);
      setModal(SEND_MODAL.OPEN_FORM);
    }
  };

  const handleClear = () => {
    setAddress('');
    setName('');
    setSearchQuery('');
  };

  const handleEnterKeyPress = () => {
    if (isValid) {
      handleContinue();
    }
  };

  const inputRef = useRef<TextInput>(null);

  const handleTextChange = (text: string) => {
    // If user starts typing after a name is selected, clear the name
    if (name && text.length > 0) {
      setName('');
      setAddress('');
    }
    setSearchQuery(text);

    if (isValidName) {
      handleContinue();
    }
  };

  const handleKeyPress = (e: any) => {
    // Handle backspace to remove selected name
    if (e.nativeEvent.key === 'Backspace' && name && searchQuery === '') {
      setName('');
      setAddress('');
      setSearchQuery('');
    }
  };

  const to = name || address;

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">To</Text>
      <Pressable
        className="relative h-16 flex-row items-center gap-2 rounded-2xl bg-card px-5"
        onPress={() => {
          if (!isSearch) {
            setSearchQuery('');
            setModal(SEND_MODAL.OPEN_SEND_SEARCH);
          }
        }}
      >
        <View className="relative flex-1">
          {to ? (
            <View className="pointer-events-none flex-row items-center">
              <View className="flex-row items-center justify-center gap-2 rounded-full bg-foreground/10 px-3 py-2">
                <Avatar name={to} className="h-7 w-7" />
                <Text className="text-base font-semibold">{name ? to : eclipseAddress(to)}</Text>
              </View>
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              className={cn('flex-1 text-base web:focus:outline-none')}
              placeholder={placeholder}
              placeholderTextColor="#ffffff80"
              value={searchQuery}
              onChangeText={handleTextChange}
              onKeyPress={handleKeyPress}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={handleEnterKeyPress}
            />
          )}
        </View>
        {isSearch && to ? (
          <Pressable
            onPress={handleClear}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted"
          >
            <X size={20} color="white" />
          </Pressable>
        ) : isSearch && isValid ? (
          <Pressable
            onPress={handleContinue}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted"
          >
            <ArrowRight size={20} color="white" />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
};

export default ToInput;
