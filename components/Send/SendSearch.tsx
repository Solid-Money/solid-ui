import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { EllipsisVertical, Plus } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { fetchAddressBook } from '@/lib/api';
import { TransactionStatus, TransactionType } from '@/lib/types';
import { cn, eclipseAddress, withRefreshToken } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';
import ToInput from './ToInput';

const SendSearch: React.FC = () => {
  const { setAddress, setModal, setName, setSearchQuery, searchQuery } = useSendStore();
  const insets = useSafeAreaInsets();
  const { activities } = useActivity();

  const { data: addressBook = [], isLoading: isLoadingAddressBook } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
  });

  const sendActivities = useMemo(() => {
    return activities
      .filter(
        activity =>
          activity.type === TransactionType.SEND &&
          activity.toAddress &&
          activity.status === TransactionStatus.SUCCESS,
      )
      .slice(0, 10)
      .map(activity => ({
        ...activity,
        walletAddress: activity.toAddress!,
      }));
  }, [activities]);

  const filteredAddressBook = useMemo(() => {
    if (!searchQuery.trim()) return addressBook;
    const query = searchQuery.toLowerCase();
    return addressBook.filter(
      entry =>
        entry.name?.toLowerCase().includes(query) ||
        entry.walletAddress.toLowerCase().includes(query),
    );
  }, [addressBook, searchQuery]);

  const filteredRecentActivities = useMemo(() => {
    if (!searchQuery.trim()) return sendActivities;
    const query = searchQuery.toLowerCase();
    return sendActivities.filter(
      activity =>
        activity.walletAddress.toLowerCase().includes(query) ||
        activity.metadata?.description?.toLowerCase().includes(query),
    );
  }, [sendActivities, searchQuery]);

  const handleToInput = (walletAddress: string, name?: string) => {
    setAddress(walletAddress);
    setName(name || '');
    setSearchQuery(name || walletAddress);
    setModal(SEND_MODAL.OPEN_FORM);
  };

  const handleAddToAddressBook = (walletAddress: string) => {
    setAddress(walletAddress);
    setModal(SEND_MODAL.OPEN_ADDRESS_BOOK);
  };

  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  return (
    <View className="gap-8">
      <ToInput />

      <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
        {filteredAddressBook.length > 0 && (
          <View className="gap-4">
            <Text className="text-base opacity-70 font-medium">Address Book</Text>
            <View className="bg-card rounded-2xl">
              {filteredAddressBook.map((entry, index) => (
                <Pressable
                  key={`${entry.walletAddress}-${index}`}
                  className={cn(
                    'flex-row items-center justify-between border-b border-foreground/10 p-4',
                    filteredAddressBook.length - 1 === index && 'border-b-0',
                  )}
                  onPress={() => handleToInput(entry.walletAddress, entry.name)}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <Avatar name={entry.name || entry.walletAddress} />
                    <View className="flex-1">
                      {entry.name && <Text className="text-base font-semibold">{entry.name}</Text>}
                      <Text className="text-sm opacity-50">
                        {eclipseAddress(entry.walletAddress)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {filteredRecentActivities.length > 0 && (
          <View className="gap-4">
            <Text className="text-base opacity-70 font-medium">Recent</Text>
            <View className="bg-card rounded-2xl">
              {filteredRecentActivities.map((activity, index) => {
                const walletAddress = activity.walletAddress;
                const addressBookEntry = addressBook.find(
                  entry => entry.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
                );
                const isInAddressBook = !!addressBookEntry;
                const displayName = addressBookEntry?.name || eclipseAddress(walletAddress);

                return (
                  <View
                    key={`${activity.clientTxId}-${index}`}
                    className={cn(
                      'flex-row items-center justify-between border-b border-foreground/10 p-4',
                      filteredRecentActivities.length - 1 === index && 'border-b-0',
                    )}
                  >
                    <Pressable
                      className="flex-row items-center gap-3 flex-1"
                      onPress={() => handleToInput(walletAddress, addressBookEntry?.name)}
                    >
                      <Avatar name={addressBookEntry?.name || walletAddress} />
                      <View className="flex-1">
                        <Text className="text-base font-semibold">{displayName}</Text>
                        <Text className="text-sm opacity-50">
                          Last sent{' '}
                          {formatDistanceToNow(new Date(parseInt(activity.timestamp) * 1000), {
                            addSuffix: true,
                          })}
                        </Text>
                      </View>
                    </Pressable>
                    {!isInAddressBook && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <EllipsisVertical color="white" size={20} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          insets={contentInsets}
                          align="end"
                          className="w-44 bg-card border-none rounded-xl"
                        >
                          <DropdownMenuItem
                            className="h-10 flex-row items-center gap-2 px-4 web:cursor-pointer rounded-xl"
                            onPress={() => handleAddToAddressBook(walletAddress)}
                          >
                            <Plus size={16} color="white" />
                            <Text className="text-white">Address book</Text>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {filteredAddressBook.length === 0 &&
          filteredRecentActivities.length === 0 &&
          !isLoadingAddressBook && (
            <View className="py-8 items-center">
              <Text className="text-muted-foreground text-center">
                {searchQuery.trim()
                  ? 'No matches found'
                  : 'No address book entries or recent sends'}
              </Text>
            </View>
          )}
      </ScrollView>
    </View>
  );
};

export default SendSearch;
