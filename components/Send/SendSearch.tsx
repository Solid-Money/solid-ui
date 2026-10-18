import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { EllipsisVertical, Plus } from 'lucide-react-native';
import { isAddress } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { fetchAddressBook } from '@/lib/api';
import { TransactionStatus, TransactionType } from '@/lib/types';
import { cn, eclipseAddress, withRefreshToken } from '@/lib/utils';
import { getCrossChainSendToken } from '@/lib/utils/cross-chain-send';
import { recipientNextModal, useSendStore } from '@/store/useSendStore';

import AddAddress from './AddAddress';
import { CashoutEntryRow } from './Cashout/CashoutEntryRow';
import SendRecipientInput from './SendRecipientInput';

const SHOW_CASHOUT_ENTRY_IN_SEARCH = false;

const SendSearch: React.FC = () => {
  const {
    setAddress,
    setModal,
    setName,
    setSearchQuery,
    searchQuery,
    isCrossChain,
    selectedToken,
    setDestinationChainId,
  } = useSendStore(
    useShallow(state => ({
      setAddress: state.setAddress,
      setModal: state.setModal,
      setName: state.setName,
      setSearchQuery: state.setSearchQuery,
      searchQuery: state.searchQuery,
      isCrossChain: state.isCrossChain,
      selectedToken: state.selectedToken,
      setDestinationChainId: state.setDestinationChainId,
    })),
  );
  const { getNetwork } = useCrossChainSendConfig({ enabled: isCrossChain });
  const [openMenuAddress, setOpenMenuAddress] = useState<string | null>(null);
  const { activities } = useActivity();

  const { data: addressBook = [], isLoading: isLoadingAddressBook } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
    staleTime: 5 * 60 * 1000, // 5 minutes - address book changes infrequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const sendActivities = useMemo(() => {
    const filtered = activities.filter(
      activity =>
        (activity.type === TransactionType.SEND ||
          activity.type === TransactionType.CROSS_CHAIN_SEND) &&
        activity.toAddress &&
        activity.status === TransactionStatus.SUCCESS,
    );

    // Deduplicate by address - keep only the most recent transaction per address
    const addressMap = new Map<string, (typeof filtered)[0]>();
    for (const activity of filtered) {
      const addressKey = activity.toAddress!.toLowerCase();
      const existing = addressMap.get(addressKey);
      // Keep the transaction with the more recent timestamp
      if (!existing || parseInt(activity.timestamp) > parseInt(existing.timestamp)) {
        addressMap.set(addressKey, activity);
      }
    }

    return Array.from(addressMap.values()).map(activity => ({
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

    // A contact saved from an earlier cross-chain send remembers its network:
    // reuse it (when this token can reach it) and skip the network step.
    if (isCrossChain) {
      const entry = addressBook.find(
        e => e.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
      );
      const token = getCrossChainSendToken(selectedToken);
      const savedNetwork = entry?.chainId ? getNetwork(entry.chainId) : undefined;
      if (
        savedNetwork &&
        token &&
        savedNetwork.status === 'live' &&
        savedNetwork.tokens.includes(token)
      ) {
        setDestinationChainId(savedNetwork.chainId);
        setModal(SEND_MODAL.OPEN_CROSS_CHAIN_FORM);
        return;
      }
    }

    setModal(recipientNextModal());
  };

  const handleAddToAddressBook = (walletAddress: string) => {
    setAddress(walletAddress);
    setModal(SEND_MODAL.OPEN_ADDRESS_BOOK);
  };

  return (
    <View className="gap-4">
      <SendRecipientInput showLabel={false} placeholder="Address or saved contact" />

      {SHOW_CASHOUT_ENTRY_IN_SEARCH && !searchQuery.trim() ? <CashoutEntryRow /> : null}

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
                      'border-b border-foreground/10',
                      filteredRecentActivities.length - 1 === index && 'border-b-0',
                    )}
                  >
                    <View className="flex-row items-center justify-between p-4">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          accessibilityLabel={`Options for ${displayName}`}
                          accessibilityState={{
                            expanded:
                              openMenuAddress?.toLowerCase() === walletAddress.toLowerCase(),
                          }}
                          onPress={() =>
                            setOpenMenuAddress(current =>
                              current?.toLowerCase() === walletAddress.toLowerCase()
                                ? null
                                : walletAddress,
                            )
                          }
                        >
                          <EllipsisVertical color="white" size={20} />
                        </Button>
                      )}
                    </View>
                    {!isInAddressBook &&
                      openMenuAddress?.toLowerCase() === walletAddress.toLowerCase() && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${displayName} to contacts`}
                          className="h-12 flex-row items-center gap-2 border-t border-foreground/10 px-4 active:bg-popover"
                          onPress={() => {
                            setOpenMenuAddress(null);
                            handleAddToAddressBook(walletAddress);
                          }}
                        >
                          <Plus size={16} color="white" />
                          <Text className="text-white">Add to contacts</Text>
                        </Pressable>
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
                  {searchQuery.trim() ? 'No matches found' : 'No contacts or recent sends'}
                </Text>
              </View>
            );
          })()}
      </ScrollView>
    </View>
  );
};

export default SendSearch;
