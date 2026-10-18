import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { isAddress } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SEND_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { fetchAddressBook } from '@/lib/api';
import { getRecentSendRecipients, SendRecipient } from '@/lib/sendRecipients';
import { eclipseAddress, withRefreshToken } from '@/lib/utils';
import { getCrossChainSendToken } from '@/lib/utils/cross-chain-send';
import { recipientNextModal, useSendStore } from '@/store/useSendStore';

import AddAddress from './AddAddress';
import { RecipientAvatar } from './RecipientAvatar';
import { SendMethodTiles } from './SendMethodTiles';
import SendRecipientInput from './SendRecipientInput';

const SendOptions: React.FC = () => {
  const {
    setAddress,
    setModal,
    setName,
    setSearchQuery,
    searchQuery,
    isCrossChain,
    selectedToken,
  } = useSendStore(
    useShallow(state => ({
      setAddress: state.setAddress,
      setModal: state.setModal,
      setName: state.setName,
      setSearchQuery: state.setSearchQuery,
      searchQuery: state.searchQuery,
      isCrossChain: state.isCrossChain,
      selectedToken: state.selectedToken,
    })),
  );
  const { getNetwork } = useCrossChainSendConfig({ enabled: isCrossChain });
  const { activities, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity();
  const { data: addressBook = [], isLoading: isLoadingAddressBook } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const recentRecipients = useMemo(
    () => getRecentSendRecipients(activities, addressBook),
    [activities, addressBook],
  );
  const query = searchQuery.trim().toLowerCase();
  const isOptions = !query;
  const matches = (recipient: SendRecipient) =>
    !query ||
    recipient.name?.toLowerCase().includes(query) ||
    recipient.walletAddress.toLowerCase().includes(query);
  const filteredRecents = recentRecipients.filter(matches);
  const filteredContacts: SendRecipient[] = addressBook
    .filter(
      entry =>
        !recentRecipients.some(
          r => r.walletAddress.toLowerCase() === entry.walletAddress.toLowerCase(),
        ),
    )
    .map(entry => ({ ...entry, saved: true }))
    .filter(matches);

  const handleSelect = (recipient: SendRecipient) => {
    const { walletAddress, name } = recipient;
    setAddress(walletAddress);
    setName(name || '');
    setSearchQuery(name || walletAddress);
    // A saved cross-chain destination can skip the network picker when supported.
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
        useSendStore.getState().setDestinationChainId(savedNetwork.chainId);
        setModal(SEND_MODAL.OPEN_CROSS_CHAIN_FORM);
        return;
      }
    }
    setModal(recipientNextModal());
  };

  const handleSave = (recipient: SendRecipient) => {
    setAddress(recipient.walletAddress);
    setName('');
    setModal(SEND_MODAL.OPEN_ADDRESS_BOOK);
  };

  const renderRecipient = (recipient: SendRecipient) => (
    <View key={recipient.walletAddress.toLowerCase()} className="flex-row items-center gap-3 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Send to ${recipient.name || eclipseAddress(recipient.walletAddress)}`}
        className="min-w-0 flex-1 flex-row items-center gap-3"
        onPress={() => handleSelect(recipient)}
      >
        <RecipientAvatar recipient={recipient} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="text-[16px] font-semibold text-white">
            {recipient.name || eclipseAddress(recipient.walletAddress)}
          </Text>
          <Text numberOfLines={1} className="text-[13px] text-white/55">
            {recipient.saved ? 'Saved contact' : 'Not saved'}
            {recipient.chainId && CHAIN_NAMES[recipient.chainId]
              ? ` · ${CHAIN_NAMES[recipient.chainId]}`
              : ''}
          </Text>
        </View>
      </Pressable>
      {!recipient.saved && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save contact ${eclipseAddress(recipient.walletAddress)}`}
          className="h-11 justify-center rounded-full bg-brand/15 px-3 active:opacity-80"
          onPress={() => handleSave(recipient)}
        >
          <Text className="text-[13px] font-medium text-brand">Save contact</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View className="gap-4 web:[font-synthesis:none]">
      <SendRecipientInput showLabel={false} placeholder="Address or saved contact" />

      {isOptions ? (
        <>
          {recentRecipients.length > 0 && (
            <View className="gap-4">
              <View className="flex-row items-center justify-between px-0.5 pt-1">
                <Text className="text-[16px] font-medium text-white/70">Recent recipients</Text>
              </View>
              <View className="flex-row items-start justify-between gap-1">
                {recentRecipients.slice(0, 5).map(recipient => (
                  <View
                    key={recipient.walletAddress.toLowerCase()}
                    className="min-w-[56px] max-w-[100px] shrink items-center gap-1.5"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Send to ${recipient.name || eclipseAddress(recipient.walletAddress)}`}
                      onPress={() => handleSelect(recipient)}
                    >
                      <RecipientAvatar recipient={recipient} compact />
                    </Pressable>
                    <View className="max-w-full flex-row items-center">
                      <Pressable className="min-w-0 shrink" onPress={() => handleSelect(recipient)}>
                        <Text numberOfLines={1} className="text-[13px] text-white/80">
                          {recipient.name?.split(' ')[0] ||
                            `${recipient.walletAddress.slice(0, 4)}…${recipient.walletAddress.slice(-4)}`}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          <SendMethodTiles />
        </>
      ) : (
        <>
          {filteredRecents.length > 0 && (
            <View className="gap-1">
              <Text className="text-[13px] text-white/55">
                Recently used contacts and addresses
              </Text>
              {filteredRecents.map(renderRecipient)}
            </View>
          )}
          {filteredContacts.length > 0 && (
            <View className="gap-1">
              <Text className="text-[16px] font-medium text-white/70">Contacts</Text>
              {filteredContacts.map(renderRecipient)}
            </View>
          )}
          {!filteredRecents.length &&
            !filteredContacts.length &&
            !isLoadingAddressBook &&
            !isLoading &&
            (query && isAddress(searchQuery.trim()) ? (
              <AddAddress address={searchQuery.trim()} />
            ) : (
              <Text className="py-8 text-center text-[14px] text-white/55">
                {query ? 'No matches found' : 'No contacts or recent sends'}
              </Text>
            ))}
          {hasNextPage && (
            <Button
              variant="ghost"
              disabled={isFetchingNextPage}
              onPress={() => void fetchNextPage()}
            >
              <Text className="text-[14px]">
                {isFetchingNextPage ? 'Loading…' : 'Load more recipients'}
              </Text>
            </Button>
          )}
        </>
      )}
    </View>
  );
};

export default SendOptions;
