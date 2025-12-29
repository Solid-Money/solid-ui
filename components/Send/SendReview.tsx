import React, { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address } from 'viem';

import NeedHelp from '@/components/NeedHelp';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useSend from '@/hooks/useSend';
import { track } from '@/lib/analytics';
import { getTotpStatus } from '@/lib/api';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';

import Key from '@/assets/images/key';
import Wallet from '@/assets/images/wallet';

const SendReview: React.FC = () => {
  const { selectedToken, amount, address, name, setTransaction, setModal } = useSendStore();

  const { send, sendStatus } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    tokenSymbol: selectedToken?.contractTickerSymbol || 'TOKEN',
    chainId: selectedToken?.chainId || 1,
    tokenType: selectedToken?.type || TokenType.ERC20,
  });

  const [isCheckingTotp, setIsCheckingTotp] = useState(false);
  const isSendLoading = sendStatus === Status.PENDING;

  const getButtonText = () => {
    if (isCheckingTotp) return 'Checking...';
    if (isSendLoading) return 'Sending';
    return 'Send';
  };

  const handleSend = async () => {
    if (!selectedToken || !amount || !address) return;

    try {
      setIsCheckingTotp(true);

      // Check if TOTP is required
      let requiresTotp = false;
      try {
        const totpStatus = await getTotpStatus();
        requiresTotp = totpStatus.verified;
      } catch (err) {
        // If TOTP check fails, assume it's not enabled
        console.error('Failed to check TOTP status:', err);
      }

      setIsCheckingTotp(false);

      // If TOTP is required, navigate to TOTP verification step
      if (requiresTotp) {
        setModal(SEND_MODAL.OPEN_TOTP_VERIFICATION);
        return;
      }

      // TOTP not required, proceed with send directly
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
        address: address,
      });

      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_COMPLETED, {
        token_symbol: selectedToken.contractTickerSymbol,
        amount: amount.toString(),
        transaction_hash: transaction.transactionHash,
        source: 'send_modal',
      });

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
      setIsCheckingTotp(false);
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
        <Text className="text-base font-medium max-w-64 text-center">
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
      value: <Text className="text-right text-base font-semibold max-w-56">{address}</Text>,
    },
  ];

  return (
    <View className="gap-8">
      <View className="items-center">
        <Text className="text-2xl font-semibold">
          <Text className="opacity-50">Send</Text> {formatNumber(Number(amount))}{' '}
          {selectedToken.contractTickerSymbol}
        </Text>
        <Text className="text-2xl font-semibold">
          <Text className="opacity-50">to</Text> {name || eclipseAddress(address)}
        </Text>
      </View>

      <View className="bg-card rounded-2xl">
        {rows.map((row, index) => (
          <View
            key={index}
            className={cn(
              'flex-row items-center justify-between border-b border-foreground/10 p-5',
              rows.length - 1 === index && 'border-b-0',
            )}
          >
            <Text className="text-base opacity-70 font-medium">{row.label}</Text>
            {row.value}
          </View>
        ))}
      </View>

      <Button
        variant="brand"
        className="rounded-xl h-12"
        onPress={handleSend}
        disabled={isSendLoading || isCheckingTotp}
      >
        <Key />
        <Text className="text-base font-bold">{getButtonText()}</Text>
        {(isSendLoading || isCheckingTotp) && <ActivityIndicator color="gray" />}
      </Button>

      <NeedHelp />
    </View>
  );
};

export default SendReview;
