import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { EllipsisVertical, Plus } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAddress } from 'viem';

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
import AddAddress from './AddAddress';
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
    return sendActivities.filter(activity => {
      const addressBookEntry = addressBook.find(
        entry => entry.walletAddress.toLowerCase() === activity.walletAddress.toLowerCase(),
      );
      return (
        activity.walletAddress.toLowerCase().includes(query) ||
        addressBookEntry?.name?.toLowerCase().includes(query)
      );
    });
  }, [sendActivities, searchQuery, addressBook]);

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
        {filteredRecentActivities.length > 0 && (
          <View className="gap-2 md:gap-4">
            <Text className="text-base font-medium opacity-70">Recent</Text>
            <View className="rounded-2xl bg-card">
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
                      className="flex-1 flex-row items-center gap-3"
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
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <EllipsisVertical color="white" size={20} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          insets={contentInsets}
                          align="end"
                          className="w-44 rounded-xl border-none bg-card"
                        >
                          <DropdownMenuItem
                            className="h-10 flex-row items-center gap-2 rounded-xl px-4 web:cursor-pointer"
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
          !isLoadingAddressBook &&
          (() => {
            if (searchQuery.trim() && isAddress(searchQuery.trim())) {
              return <AddAddress address={searchQuery.trim()} />;
            }
            return (
              <View className="items-center py-8">
                <Text className="text-center text-muted-foreground">
                  {searchQuery.trim()
                    ? 'No matches found'
                    : 'No address book entries or recent sends'}
                </Text>
              </View>
            );
          })()}
      </ScrollView>
    </View>
  );
};

export default SendSearch;
