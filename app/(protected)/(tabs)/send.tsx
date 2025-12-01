import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import { Address, formatUnits, isAddress } from 'viem';
import { z } from 'zod';

import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TokenSelectorModal from '@/components/SendModal/TokenSelectorModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useSend from '@/hooks/useSend';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenBalance, TokenType } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';
import Toast from 'react-native-toast-message';

const SendPage = () => {
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const { setModal, setTransaction } = useSendStore();
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens, baseTokens]);

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
    resolver: zodResolver(sendSchema),
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: {
      amount: '',
      address: '',
    },
  });

  const { send, sendStatus, resetSendStatus } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    tokenSymbol: selectedToken?.contractTickerSymbol || 'TOKEN',
    chainId: selectedToken?.chainId || 1,
    tokenType: selectedToken?.type || TokenType.ERC20,
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
    if (sendStatus === Status.PENDING) return 'Sending';
    if (sendStatus === Status.ERROR) return 'Error while Sending';
    if (sendStatus === Status.SUCCESS) return 'Successfully sent!';
    if (!selectedToken) return 'Select token';
    if (!isValid) return 'Send';
    return 'Send';
  };

  const onSubmit = async (data: any) => {
    if (!selectedToken) return;

    try {
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_INITIATED, {
        token_symbol: selectedToken.contractTickerSymbol,
        token_address: selectedToken.contractAddress,
        chain_id: selectedToken.chainId,
        amount: data.amount.toString(),
        to_address: data.address,
        source: 'send_page',
      });

      const transaction = await send(data.amount.toString(), data.address as Address);
      setTransaction({
        amount: Number(data.amount),
        address: data.address,
      });

      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_COMPLETED, {
        token_symbol: selectedToken.contractTickerSymbol,
        amount: data.amount.toString(),
        transaction_hash: transaction.transactionHash,
        source: 'send_page',
      });

      if (Platform.OS === 'web') {
        setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);
      } else {
        // TODO: handle transaction status on mobile
        // setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);
      }
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
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_FAILED, {
        token_symbol: selectedToken?.contractTickerSymbol,
        amount: data.amount.toString(),
        error: String(error),
        source: 'send_page',
      });
    }
  };

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 px-4 py-8 md:py-12">
        {/* Form Fields */}
        <View className="max-w-md mx-auto w-full gap-2">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-xl md:text-3xl font-semibold text-center">Send</Text>
            <View className="w-10" />
          </View>
          {/* To Section */}
          <View className="gap-4 bg-card rounded-xl p-4">
            <Text className="text-muted-foreground font-medium">To</Text>
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
                    returnKeyType="next"
                    style={{ textAlign: 'left' }}
                    onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                  />
                )}
              />
              {/* <ChevronDown size={20} color="#666" /> */}
            </View>
          </View>

          {/* Send Section */}
          <View className="gap-2 bg-card rounded-xl p-4">
            <Text className="text-muted-foreground font-medium">Send</Text>
            <View className="flex-row items-center justify-between gap-2">
              <Pressable
                className="flex-row items-center gap-3 web:hover:bg-accent rounded-full px-2 h-10"
                onPress={() => {
                  track(TRACKING_EVENTS.SEND_PAGE_TOKEN_SELECTOR_OPENED, {
                    source: 'send_page',
                    current_token: selectedToken?.contractTickerSymbol || null,
                  });
                  setShowTokenSelector(true);
                }}
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
                      <Text className="text-sm font-medium">
                        {selectedToken.contractTickerSymbol}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
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
                    <View className="w-6 h-6 bg-primary/20 rounded-full" />
                    <Text className="text-muted-foreground text-sm font-medium">Select token</Text>
                    <ChevronDown size={16} color="#666" />
                  </>
                )}
              </Pressable>

              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'flex-1 web:focus:outline-none text-white text-4xl font-bold text-right',
                      // errors.amount && "text-red-400"
                    )}
                    placeholder="0"
                    placeholderTextColor="#666"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    style={{ minWidth: 80 }}
                    returnKeyType="done"
                    // onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                  />
                )}
              />
            </View>
          </View>

          {/* Send Button */}
          <Button
            variant="brand"
            className="rounded-xl"
            size="lg"
            onPress={handleSubmit(onSubmit)}
            disabled={!selectedToken || !isValid || isSendLoading}
          >
            <Text className="font-semibold">{getSendText()}</Text>
            {isSendLoading && <ActivityIndicator color="gray" />}
          </Button>
        </View>
      </View>

      {/* Token Selector Modal */}
      <TokenSelectorModal
        isOpen={showTokenSelector}
        onClose={() => {
          setShowTokenSelector(false);
          Keyboard.dismiss(); // Dismiss keyboard when closing modal
        }}
        tokens={allTokens}
        onSelectToken={token => {
          track(TRACKING_EVENTS.SEND_PAGE_TOKEN_SELECTED, {
            token_symbol: token.contractTickerSymbol,
            token_address: token.contractAddress,
            chain_id: token.chainId,
            balance: token.balance,
            source: 'send_page',
          });
          setSelectedToken(token);
          Keyboard.dismiss(); // Dismiss keyboard when selecting token
        }}
        selectedToken={selectedToken}
      />
    </PageLayout>
  );
};

export default SendPage;
