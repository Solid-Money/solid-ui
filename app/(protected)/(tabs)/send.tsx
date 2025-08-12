import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Address, formatUnits, isAddress } from 'viem';
import { z } from 'zod';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TokenSelectorModal from '@/components/SendModal/TokenSelectorModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import useSend from '@/hooks/useSend';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';
import Toast from 'react-native-toast-message';

interface TokenBalance {
  contractTickerSymbol: string;
  contractName: string;
  contractAddress: string;
  balance: string;
  quoteRate?: number;
  logoUrl?: string;
  contractDecimals: number;
  type: string;
  verified?: boolean;
  chainId: number;
}

const SendPage = () => {
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const { setModal, setTransaction } = useSendStore();

  const { ethereumTokens, fuseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens]);

  // Create form schema with validation (reusing patterns from SendModal)
  const sendSchema = useMemo(() => {
    const balanceAmount = selectedToken
      ? Number(formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals))
      : 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} ${selectedToken?.contractTickerSymbol || ''}`,
        )
        .transform(val => Number(val)),
      address: z
        .string()
        .refine(isAddress, 'Please enter a valid Ethereum address')
        .transform(value => value.toLowerCase()),
    });
  }, [selectedToken]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm({
    resolver: zodResolver(sendSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
      address: '',
    },
  });

  const { send, sendStatus, resetSendStatus } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    chainId: selectedToken?.chainId || 1,
  });

  // Reset form and status after 5 seconds of success
  useEffect(() => {
    if (sendStatus === Status.SUCCESS) {
      const timeout = setTimeout(() => {
        reset();
        setSelectedToken(null);
        resetSendStatus();
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [sendStatus, reset, resetSendStatus]);

  const isSendLoading = sendStatus === Status.PENDING;

  const getSendText = () => {
    if (errors.amount) return errors.amount.message;
    if (errors.address) return errors.address.message;
    if (sendStatus === Status.PENDING) return 'Sending...';
    if (sendStatus === Status.ERROR) return 'Error while Sending';
    if (sendStatus === Status.SUCCESS) return 'Successfully sent!';
    if (!selectedToken) return 'Select token';
    if (!isValid) return 'Send';
    return 'Send';
  };

  const onSubmit = async (data: any) => {
    if (!selectedToken) return;

    try {
      const transaction = await send(data.amount.toString(), data.address as Address);
      setTransaction({
        amount: Number(data.amount),
        address: data.address,
      });
      setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Send transaction completed',
        text2: `${data.amount} ${selectedToken?.contractTickerSymbol}`,
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
      reset();
    } catch (error) {
      console.error('Send failed:', error);
    }
  };

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      {Platform.OS !== 'web' && <NavbarMobile />}
      {Platform.OS === 'web' && <Navbar />}
      <View className="flex-1 bg-black px-6 py-12">
        {/* Header */}
        <Text className="text-white text-2xl font-semibold text-center mb-12">Send</Text>

        {/* Form Fields */}
        <View className="max-w-md mx-auto w-full gap-4">
          {/* To Section */}
          <View className="bg-card rounded-2xl px-4 py-5">
            <Text className="text-gray-400 text-sm mb-2">To</Text>
            <View className="flex-row items-center justify-between">
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'flex-1 text-white text-base web:focus:outline-none',
                      // errors.address && "text-red-400"
                    )}
                    placeholder="Enter or select an address..."
                    placeholderTextColor="#666"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />
              {/* <ChevronDown size={20} color="#666" /> */}
            </View>
          </View>

          {/* Send Section */}
          <View className="bg-card rounded-2xl px-4 py-4">
            <Text className="text-gray-400 text-sm mb-2">Send</Text>
            <View className="flex-row items-center">
              <Pressable
                className="flex-row items-center gap-3"
                onPress={() => setShowTokenSelector(true)}
              >
                {selectedToken ? (
                  <>
                    <RenderTokenIcon
                      tokenIcon={getTokenIcon({
                        logoUrl: selectedToken.logoUrl,
                        tokenSymbol: selectedToken.contractTickerSymbol,
                        size: 24,
                      })}
                      size={24}
                    />
                    <View>
                      <Text className="text-white text-base">
                        {selectedToken.contractTickerSymbol}
                      </Text>
                      <Text className="text-gray-400 text-xs">
                        {formatNumber(
                          Number(
                            formatUnits(
                              BigInt(selectedToken.balance || '0'),
                              selectedToken.contractDecimals,
                            ),
                          ),
                        )}{' '}
                        {selectedToken.contractTickerSymbol}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="#666" />
                  </>
                ) : (
                  <>
                    <View className="w-6 h-6 bg-gray-600 rounded-full" />
                    <Text className="text-gray-400 text-base">Select token</Text>
                    <ChevronDown size={16} color="#666" />
                  </>
                )}
              </Pressable>

              <View className="flex-1" />

              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'w-full web:focus:outline-none text-white text-6xl font-light text-right',
                      // errors.amount && "text-red-400"
                    )}
                    placeholder="0"
                    placeholderTextColor="#666"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    style={{ minWidth: 80 }}
                  />
                )}
              />
            </View>
          </View>

          {/* Send Button */}
          <View className="mt-8">
            <Button
              className="bg-green-500 rounded-2xl h-14 w-full"
              onPress={handleSubmit(onSubmit)}
              disabled={!selectedToken || !isValid || isSendLoading}
            >
              <Text className="text-black text-lg font-semibold">{getSendText()}</Text>
            </Button>
          </View>
        </View>

        {/* Token Selector Modal */}
        <TokenSelectorModal
          isOpen={showTokenSelector}
          onClose={() => setShowTokenSelector(false)}
          tokens={allTokens}
          onSelectToken={setSelectedToken}
          selectedToken={selectedToken}
        />
      </View>
    </SafeAreaView>
  );
};

export default SendPage;
