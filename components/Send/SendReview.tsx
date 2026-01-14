import React from 'react';
import { Control } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { Address } from 'viem';

import Key from '@/assets/images/key';
import Wallet from '@/assets/images/wallet';
import NeedHelp from '@/components/NeedHelp';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { AddressBookFormData, useAddressBook } from '@/hooks/useAddressBook';
import { useIsContract } from '@/hooks/useIsContract';
import useSend from '@/hooks/useSend';
import { useTotp } from '@/hooks/useTotp';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';

import ContractAddressWarning from './ContractAddressWarning';
import SaveContact from './SaveContact';

const SendReview: React.FC = () => {
  const { selectedToken, amount, address, name, setTransaction, setModal, setName } =
    useSendStore();
  const { refetchAll } = useActivity();

  const { send, sendStatus, totpModal } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    tokenSymbol: selectedToken?.contractTickerSymbol || 'TOKEN',
    chainId: selectedToken?.chainId || 1,
    tokenType: selectedToken?.type || TokenType.ERC20,
  });

  const { isContract } = useIsContract({
    address: address as Address | undefined,
    chainId: selectedToken?.chainId,
    enabled: !!address && !!selectedToken?.chainId,
  });

  const {
    control: nameControl,
    watch: watchName,
    handleAddContact,
    errors: nameErrors,
    hasSkipped2fa,
  } = useAddressBook({
    defaultAddress: address || '',
    defaultName: name || '',
    optionalName: true,
    onSuccess: () => {
      // Prevent navigation
    },
  });

  const { isVerified: isTotpVerified } = useTotp();

  const isSendLoading = sendStatus === Status.PENDING;
  const showSkip2fa = isTotpVerified && !hasSkipped2fa;
  const isContact = !name || showSkip2fa;

  const getButtonText = () => {
    if (isSendLoading) return 'Sending';
    return 'Send';
  };

  const handleSend = async () => {
    if (!selectedToken || !amount || !address) return;

    const nameValue = watchName('name');
    const skip2fa = watchName('skip2fa');
    if ((nameValue && nameValue.trim()) || skip2fa) {
      try {
        await handleAddContact();
        setName(nameValue?.trim() || '');
      } catch (error) {
        console.error('Failed to add to address book:', error);
      }
    }

    try {
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_INITIATED, {
        token_symbol: selectedToken.contractTickerSymbol,
        token_address: selectedToken.contractAddress,
        chain_id: selectedToken.chainId,
        amount: amount.toString(),
        to_address: address,
        source: 'send_modal',
      });

      const transaction = await send(amount.toString(), address as Address);
      setTransaction({
        amount: Number(amount),
        address: address as Address,
      });

      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_COMPLETED, {
        token_symbol: selectedToken.contractTickerSymbol,
        amount: amount.toString(),
        transaction_hash: transaction.transactionHash,
        source: 'send_modal',
      });

      refetchAll();

      setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);

      Toast.show({
        type: 'success',
        text1: 'Send transaction completed',
        text2: `${amount} ${selectedToken?.contractTickerSymbol}`,
        props: {
          link: `${getChain(selectedToken?.chainId)?.blockExplorers?.default.url}/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({
            logoUrl: selectedToken?.logoUrl,
            tokenSymbol: selectedToken?.contractTickerSymbol,
            size: 24,
          }),
        },
      });
    } catch (error) {
      console.error('Send failed:', error);
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_FAILED, {
        token_symbol: selectedToken?.contractTickerSymbol,
        amount: amount.toString(),
        error: String(error),
        source: 'send_modal',
      });
      Toast.show({
        type: 'error',
        text1: 'Error while sending',
      });
    }
  };

  if (!selectedToken || !amount || !address) {
    return (
      <View className="items-center">
        <Text className="max-w-64 text-center text-base font-medium">
          Missing or invalid information. Please go back and fill all fields.
        </Text>
      </View>
    );
  }

  const balanceUSD = Number(amount) * (selectedToken.quoteRate || 0);

  const rows = [
    {
      label: 'Amount',
      value: (
        <View className="items-end">
          <View className="flex-row items-center gap-2">
            <RenderTokenIcon
              tokenIcon={getTokenIcon({
                logoUrl: selectedToken.logoUrl,
                tokenSymbol: selectedToken.contractTickerSymbol,
                size: 20,
              })}
              size={20}
            />
            <Text className="text-base font-semibold">
              {formatNumber(Number(amount))} {selectedToken.contractTickerSymbol}
            </Text>
          </View>
          <Text className="text-sm opacity-50">${formatNumber(balanceUSD, 2)}</Text>
        </View>
      ),
    },
    {
      label: 'Network',
      value: (
        <View className="flex-row items-center gap-2">
          <Image
            source={getBridgeChain(selectedToken.chainId).icon}
            style={{ width: 20, height: 20 }}
          />
          <Text className="text-base font-semibold">
            {getBridgeChain(selectedToken.chainId).name}
          </Text>
        </View>
      ),
    },
    {
      label: 'From',
      value: (
        <View className="flex-row items-center gap-2">
          <Wallet rotate={180} />
          <Text className="text-base font-semibold">Wallet</Text>
        </View>
      ),
    },
    {
      label: 'To',
      value: <Text className="text-right text-xs font-semibold">{address}</Text>,
    },
  ];

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="flex-1 gap-5">
        <View className="items-center">
          <Text className="text-2xl font-semibold">
            <Text className="opacity-50">Send</Text> {formatNumber(Number(amount))}{' '}
            {selectedToken.contractTickerSymbol}
          </Text>
          <Text className="text-2xl font-semibold">
            <Text className="opacity-50">to</Text> {name || eclipseAddress(address)}
          </Text>
        </View>

        {isContract && (
          <ContractAddressWarning chainName={getBridgeChain(selectedToken?.chainId || 1).name} />
        )}

        {isContact && (
          <SaveContact
            control={nameControl as Control<AddressBookFormData>}
            errors={nameErrors}
            showSkip2fa={showSkip2fa}
            name={name}
          />
        )}

        <View className="rounded-2xl bg-card">
          {rows.map((row, index) => (
            <View
              key={index}
              className={cn(
                'flex-row items-center justify-between gap-1 border-b border-foreground/10 p-5',
                rows.length - 1 === index && 'border-b-0',
              )}
            >
              <Text className="text-base font-medium opacity-70">{row.label}</Text>
              {row.value}
            </View>
          ))}
        </View>
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-xl"
        onPress={handleSend}
        disabled={isSendLoading}
      >
        <Key />
        <Text className="text-base font-bold">{getButtonText()}</Text>
        {isSendLoading && <ActivityIndicator color="gray" />}
      </Button>

      <NeedHelp />
      {totpModal}
    </View>
  );
};

export default SendReview;
