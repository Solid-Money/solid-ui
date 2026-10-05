import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import { isAddress } from 'viem';
import { fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { track } from '@/lib/analytics';
import { fetchAddressBook } from '@/lib/api';
import { AddressBookResponse } from '@/lib/types';
import { cn, eclipseAddress, withRefreshToken } from '@/lib/utils';
import { detectAddressFormat, UNSUPPORTED_ADDRESS_MESSAGE } from '@/lib/utils/address-format';
import { getCrossChainSendToken, isOwnWallet } from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import { LetterAvatar } from './shared';

/**
 * Screen 1 of the cross-chain send: the recipient address and where it lives.
 * The exchange decides which networks the next step can offer, which is why
 * it is asked here rather than inferred later.
 */
const CrossChainDestination: React.FC = () => {
  const {
    address,
    exchange,
    selectedToken,
    setAddress,
    setName,
    setExchange,
    setDestinationChainId,
    setModal,
  } = useSendStore(
    useShallow(state => ({
      address: state.address,
      exchange: state.exchange,
      selectedToken: state.selectedToken,
      setAddress: state.setAddress,
      setName: state.setName,
      setExchange: state.setExchange,
      setDestinationChainId: state.setDestinationChainId,
      setModal: state.setModal,
    })),
  );
  const { config, getExchange } = useCrossChainSendConfig();
  const token = getCrossChainSendToken(selectedToken);
  const [input, setInput] = useState(address);

  const { data: addressBook = [] } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const format = useMemo(() => detectAddressFormat(input), [input]);
  const isValidAddress = format === 'evm';
  const unsupportedMessage = UNSUPPORTED_ADDRESS_MESSAGE[format];

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      const trimmed = text.trim();
      if (isAddress(trimmed)) {
        setAddress(trimmed);
        setName('');
      } else if (address) {
        setAddress('');
      }
    },
    [address, setAddress, setName],
  );

  const handlePaste = useCallback(async () => {
    try {
      const text =
        Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard
          ? await navigator.clipboard.readText()
          : await Clipboard.getStringAsync();
      if (text) handleInputChange(text.trim());
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }, [handleInputChange]);

  const handleSelectExchange = useCallback(
    (id: string) => {
      setExchange(id);
      // The network list depends on the exchange, so a previous pick is void.
      setDestinationChainId(null);
      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_DESTINATION_SELECTED, {
        exchange: id,
        token,
        source: 'chip',
      });
    },
    [setExchange, setDestinationChainId, token],
  );

  const handleContinue = useCallback(() => {
    if (!isValidAddress || !exchange) return;
    setModal(SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK);
  }, [isValidAddress, exchange, setModal]);

  const handleSavedPress = useCallback(
    (entry: AddressBookResponse) => {
      setAddress(entry.walletAddress);
      setInput(entry.walletAddress);
      setName(entry.name || '');
      const savedExchange = entry.exchange ?? null;
      const savedChainId = entry.chainId ?? null;
      if (savedExchange) setExchange(savedExchange);
      setDestinationChainId(savedChainId);
      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_DESTINATION_SELECTED, {
        exchange: savedExchange ?? exchange,
        token,
        source: 'saved_address',
      });
      if (savedExchange && savedChainId) {
        setModal(SEND_MODAL.OPEN_CROSS_CHAIN_FORM);
      } else if (savedExchange || exchange) {
        setModal(SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK);
      }
    },
    [setAddress, setName, setExchange, setDestinationChainId, setModal, exchange, token],
  );

  const savedSubtitle = (entry: AddressBookResponse) => {
    const parts = [eclipseAddress(entry.walletAddress)];
    if (entry.exchange) {
      const saved = getExchange(entry.exchange);
      parts.push(isOwnWallet(entry.exchange) ? 'My own wallet' : (saved?.name ?? entry.exchange));
    }
    if (entry.chainId) {
      const network = config?.networks.find(n => n.chainId === entry.chainId);
      parts.push(network?.name ?? (entry.chainId === fuse.id ? 'Fuse' : String(entry.chainId)));
    }
    if (entry.token) parts.push(entry.token);
    return parts.join(' · ');
  };

  const canContinue = isValidAddress && !!exchange;

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-5">
        <View>
          <View className="flex-row items-center justify-between rounded-[15px] bg-card py-[14px] pl-[18px] pr-[14px]">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm leading-[18px] text-white/70">To</Text>
              <TextInput
                className="text-lg font-medium text-white web:focus:outline-none"
                placeholder="Address"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={input}
                onChangeText={handleInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>
            <Pressable
              onPress={handlePaste}
              hitSlop={8}
              className="rounded-[18px] bg-[#333] px-2 pb-[3px] pt-[2px] web:hover:bg-[#444]"
            >
              <Text className="text-sm leading-4 text-white/70">Paste</Text>
            </Pressable>
          </View>
          {unsupportedMessage ? (
            <Text className="mt-2 text-sm text-red-400">{unsupportedMessage}</Text>
          ) : null}
        </View>

        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-base font-semibold text-white">Where are you sending?</Text>
            <Text className="text-sm leading-[18px] text-white/70">
              We only show networks it accepts. Exchanges don’t accept Fuse.
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {(config?.exchanges ?? []).map(item => {
              const isSelected = item.id === exchange;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectExchange(item.id)}
                  className={cn(
                    'rounded-full px-4 py-[10px]',
                    isSelected
                      ? 'border-[1.5px] border-brand bg-[rgba(148,242,127,0.12)]'
                      : 'border border-white/[0.12] bg-card web:hover:bg-card-hover',
                  )}
                >
                  <Text
                    className={cn(
                      'text-base font-medium',
                      isSelected ? 'text-brand' : 'text-white',
                    )}
                  >
                    {isOwnWallet(item.id) ? 'My own wallet' : item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {addressBook.length > 0 ? (
          <View className="gap-3">
            <Text className="text-base font-semibold text-white">Saved addresses</Text>
            <View className="overflow-hidden rounded-[15px] bg-card">
              {addressBook.map((entry, index) => {
                const title = entry.name || eclipseAddress(entry.walletAddress);
                return (
                  <Pressable
                    key={`${entry.walletAddress}-${entry.chainId ?? ''}-${entry.exchange ?? ''}`}
                    onPress={() => handleSavedPress(entry)}
                    className={cn(
                      'flex-row items-center gap-[13px] py-[17px] pl-[18px] pr-5 web:hover:bg-card-hover',
                      index > 0 && 'border-t border-white/10',
                    )}
                  >
                    <LetterAvatar letter={title.charAt(0).toUpperCase()} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-lg font-semibold leading-[22px] text-white">
                        {title}
                      </Text>
                      <Text className="text-sm leading-[18px] text-white/70" numberOfLines={1}>
                        {savedSubtitle(entry)}
                      </Text>
                    </View>
                    <ChevronRight size={20} color="white" />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-full"
        size="lg"
        onPress={handleContinue}
        disabled={!canContinue}
      >
        <Text className="text-base font-bold">Continue</Text>
      </Button>
    </View>
  );
};

export default CrossChainDestination;
