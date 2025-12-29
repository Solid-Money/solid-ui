import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { isAddress } from 'viem';

import Avatar from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { fetchAddressBook } from '@/lib/api';
import { cn, withRefreshToken } from '@/lib/utils';
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

  const isValidName = useMemo(() => {
    if (!searchQuery.trim()) return false;
    return addressBook.some(
      entry => entry.name?.toLowerCase() === searchQuery.trim().toLowerCase(),
    );
  }, [searchQuery, addressBook]);

  const isValid = isValidAddress || isValidName;

  const handleContinue = () => {
    if (isValidAddress) {
      const trimmedQuery = searchQuery.trim();
      setAddress(trimmedQuery);
      setName('');
      setSearchQuery(trimmedQuery);
      setModal(SEND_MODAL.OPEN_FORM);
    } else if (isValidName) {
      const entry = addressBook.find(
        entry => entry.name?.toLowerCase() === searchQuery.trim().toLowerCase(),
      );
      if (entry) {
        setAddress(entry.walletAddress);
        setName(entry.name || '');
        setSearchQuery(entry.name || entry.walletAddress);
        setModal(SEND_MODAL.OPEN_FORM);
      }
    }
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
  };

  const handleKeyPress = (e: any) => {
    // Handle backspace to remove selected name
    if (e.nativeEvent.key === 'Backspace' && name && searchQuery === '') {
      setName('');
      setAddress('');
      setSearchQuery('');
    }
  };

  // Show placeholder only when there's no name and no search query
  const showPlaceholder = !name && !searchQuery;

  return (
    <View className="gap-4">
      <Text className="text-base opacity-70 font-medium">To</Text>
      <View className="flex-row items-center gap-2 bg-card rounded-2xl px-5 h-16 relative">
        <View className="flex-1 relative">
          <TextInput
            ref={inputRef}
            className={cn('flex-1 text-base web:focus:outline-none')}
            placeholder={showPlaceholder ? placeholder : ''}
            placeholderTextColor="#ffffff80"
            value={searchQuery}
            onChangeText={handleTextChange}
            onKeyPress={handleKeyPress}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={handleEnterKeyPress}
            style={{
              width: '100%',
              color: name ? 'transparent' : 'white',
            }}
          />
          {name && (
            <View
              className="absolute left-0 top-0 bottom-0 flex-row items-center pointer-events-none"
              style={{
                paddingVertical: Platform.OS === 'web' ? 0 : 2,
              }}
            >
              <View className="flex-row justify-center items-center gap-2 px-3 py-2 bg-foreground/10 rounded-full">
                <Avatar name={name} className="w-7 h-7" />
                <Text className="text-base font-semibold">{name}</Text>
              </View>
            </View>
          )}
        </View>
        {isSearch && isValid && (
          <Pressable
            onPress={handleContinue}
            className="h-10 w-10 flex items-center justify-center bg-popover rounded-full web:transition-colors web:hover:bg-muted"
          >
            <ArrowRight size={20} color="white" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default ToInput;
