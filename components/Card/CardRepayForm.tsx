import React, { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Fuel, Wallet as WalletIcon } from 'lucide-react-native';
import { useActiveAccount } from 'thirdweb/react';
import { Address, formatUnits, zeroAddress } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance } from 'wagmi';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { getBridgeChain } from '@/constants/bridge';
import { CARD_REPAY_MODAL } from '@/constants/modals';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { useActivity } from '@/hooks/useActivity';
import useRepayAndWithdrawCollateral from '@/hooks/useRepayAndWithdrawCollateral';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardRepayStore } from '@/store/useCardRepayStore';

type FormData = { amount: string };

const FEE_AMOUNT = 0; // 0 USDC from design

export default function CardRepayForm() {
  const account = useActiveAccount();
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivity();
  const { setTransaction, setModal, selectedToken } = useCardRepayStore(
    useShallow(state => ({
      setTransaction: state.setTransaction,
      setModal: state.setModal,
      selectedToken: state.selectedToken,
    })),
  );
  const { totalBorrowed: borrowedAmount, totalSupplied } = useAaveBorrowPosition();
  const { repayAndWithdrawCollateral } = useRepayAndWithdrawCollateral();
  const [repayStatus, setRepayStatus] = useState<Status>(Status.IDLE);

  const eoaAddress = account?.address as Address | undefined;
  const tokenType = selectedToken?.type || TokenType.ERC20;
  const isNative = tokenType === TokenType.NATIVE;

  // Get balance for selected token
  const { data: balanceNative, isLoading: isBalanceNativeLoading } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    chainId: selectedToken?.chainId || fuse.id,
    query: {
      enabled: !!eoaAddress && !!selectedToken && isNative,
    },
  });

  const { data: balanceERC20, isLoading: isBalanceERC20Loading } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    token:
      selectedToken && !isNative && selectedToken.contractAddress !== zeroAddress
        ? (selectedToken.contractAddress as `0x${string}`)
        : !selectedToken
          ? (USDC_STARGATE as `0x${string}`)
          : undefined,
    chainId: selectedToken?.chainId || fuse.id,
    query: {
      enabled:
        !!eoaAddress &&
        (!selectedToken || (!isNative && selectedToken.contractAddress !== zeroAddress)),
    },
  });

  const balance = isNative ? balanceNative?.value : balanceERC20?.value;
  const isLoading = isNative ? isBalanceNativeLoading : isBalanceERC20Loading;

  const balanceAmount = useMemo(() => {
    if (!selectedToken) {
      // Fallback to USDC balance if no token selected
      if (balanceERC20) {
        return Number(formatUnits(balanceERC20.value, 6));
      }
      return 0;
    }
    if (balance) {
      return Number(formatUnits(balance, selectedToken.contractDecimals));
    }
    return Number(
      formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals),
    );
  }, [selectedToken, balance, balanceERC20]);

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${selectedToken?.contractTickerSymbol || 'USDC'}`,
        })
        .refine(val => Number(val) <= borrowedAmount, {
          error: `Cannot repay more than ${formatNumber(borrowedAmount)} USDC`,
        }),
    });
  }, [balanceAmount, selectedToken, borrowedAmount]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');
  const amountValue = watchedAmount ? Number(watchedAmount) : 0;
  const usdValue = useMemo(() => {
    if (!selectedToken) return amountValue; // 1:1 for USDC
    return amountValue * (selectedToken.quoteRate || 1);
  }, [amountValue, selectedToken]);

  const handleMaxPress = () => {
    if (balanceAmount > 0) {
      const maxAmount = Math.min(balanceAmount, borrowedAmount).toString();
      setValue('amount', maxAmount);
      trigger('amount');
    }
  };

  const handleTokenSelectorPress = useCallback(() => {
    setModal(CARD_REPAY_MODAL.OPEN_TOKEN_SELECTOR);
  }, [setModal]);

  const resetRepayStatus = useCallback(() => {
    setRepayStatus(Status.IDLE);
  }, []);

  const onSubmit = useCallback(
    async (data: any) => {
      try {
        if (!user) {
          Toast.show({
            type: 'error',
            text1: 'User not authenticated',
            text2: 'Please refresh and try again',
          });
          return;
        }

        setRepayStatus(Status.PENDING);

        // Create activity event
        const clientTxId = await createActivity({
          type: TransactionType.CARD_TRANSACTION,
          title: `Card Repay`,
          shortTitle: `Card Repay`,
          amount: data.amount,
          symbol: 'USDC',
          chainId: fuse.id,
          fromAddress: user.safeAddress,
          toAddress: ADDRESSES.fuse.aaveV3Pool,
          status: TransactionStatus.PENDING,
          metadata: {
            description: `Repay ${data.amount} USDC to card borrow position`,
            processingStatus: 'sending',
            tokenAddress: selectedToken?.contractAddress ?? USDC_STARGATE,
          },
        });

        const tx = await repayAndWithdrawCollateral(data.amount);

        await updateActivity(clientTxId, {
          status: TransactionStatus.PENDING,
          hash: tx.transactionHash,
          url: `https://explorer.fuse.io/tx/${tx.transactionHash}`,
          metadata: {
            txHash: tx.transactionHash,
            processingStatus: 'processing',
          },
        });

        setRepayStatus(Status.SUCCESS);
        setTransaction({ amount: Number(data.amount) });
        setModal(CARD_REPAY_MODAL.OPEN_TRANSACTION_STATUS);
        reset();

        setTimeout(() => {
          resetRepayStatus();
        }, 2000);
      } catch (error) {
        setRepayStatus(Status.ERROR);
        console.error('Repay error:', error);
        Toast.show({
          type: 'error',
          text1: 'Repay failed',
          text2: 'Please try again or check your wallet balance',
        });
      }
    },
    [
      user,
      createActivity,
      updateActivity,
      repayAndWithdrawCollateral,
      reset,
      resetRepayStatus,
      setTransaction,
      setModal,
    ],
  );

  const disabled = useMemo(() => {
    return repayStatus === Status.PENDING || !formState.isValid || !watchedAmount;
  }, [repayStatus, formState.isValid, watchedAmount]);

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="flex-1 gap-6">
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Amount</Text>
            {selectedToken && (
              <View className="flex-row items-center gap-2">
                <WalletIcon size={16} color="#ffffff80" />
                <Text className="text-base opacity-50">
                  {isLoading
                    ? '...'
                    : `${formatNumber(balanceAmount)} ${selectedToken.contractTickerSymbol}`}
                </Text>
                {balanceAmount > 0 && <Max onPress={handleMaxPress} />}
              </View>
            )}
          </View>
          <View
            className={cn(
              'flex-row items-center justify-between gap-2 rounded-2xl bg-card p-4',
              formState.errors.amount && 'border border-red-500',
            )}
          >
            <View className="flex-1">
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'flex-1 text-3xl font-semibold text-white web:focus:outline-none',
                    )}
                    placeholder="0.0"
                    placeholderTextColor="#ffffff80"
                    value={value as any}
                    onChangeText={text => {
                      onChange(text);
                    }}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    style={{ minWidth: 80 }}
                    returnKeyType="done"
                  />
                )}
              />
              <Text className="text-sm opacity-50">${formatNumber(usdValue, 2)}</Text>
            </View>
            <Pressable
              className="h-12 flex-row items-center gap-1.5 rounded-full bg-foreground/10 px-3 web:hover:bg-foreground/20"
              onPress={handleTokenSelectorPress}
            >
              {selectedToken ? (
                <>
                  <RenderTokenIcon
                    tokenIcon={getTokenIcon({
                      logoUrl: selectedToken.logoUrl,
                      tokenSymbol: selectedToken.contractTickerSymbol,
                      size: 28,
                    })}
                    size={28}
                  />
                  <View className="flex-col">
                    <Text className="text-lg/5 font-semibold">
                      {selectedToken.contractTickerSymbol}
                    </Text>
                    <Text className="text-sm/4 font-medium opacity-50">
                      {getBridgeChain(selectedToken.chainId).name}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Image
                    source={getAsset('images/usdc-4x.png')}
                    alt="USDC"
                    style={{ width: 28, height: 28 }}
                  />
                  <View className="flex-col">
                    <Text className="text-lg/5 font-semibold">USDC</Text>
                    <Text className="text-sm/4 font-medium opacity-50">Fuse</Text>
                  </View>
                </>
              )}
              <ChevronDown size={20} color="white" />
            </Pressable>
          </View>
          {formState.errors.amount && (
            <Text className="text-sm text-red-400">{formState.errors.amount.message}</Text>
          )}
        </View>

        {/* Details Section */}
        <View className="rounded-2xl bg-card p-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Amount borrowed</Text>
            <Text className="text-base font-bold text-white">${formatNumber(borrowedAmount)}</Text>
          </View>
          <View className="mb-4 h-px w-full bg-white/10" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Collateral supplied</Text>
            <Text className="text-base font-bold text-white">
              {formatNumber(totalSupplied)} soUSD
            </Text>
          </View>
          <View className="mb-4 h-px w-full bg-white/10" />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Fuel color="rgba(255, 255, 255, 0.7)" size={16} />
              <Text className="text-base font-medium opacity-70">Fee</Text>
            </View>
            <Text className="text-base font-bold text-white">{formatNumber(FEE_AMOUNT)} USDC</Text>
          </View>
        </View>
      </View>

      <View className="flex-1" />

      <Button
        variant="brand"
        className="mt-7 h-12 rounded-xl"
        disabled={disabled}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-base font-bold text-black">
          {repayStatus === Status.PENDING ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            'Repay'
          )}
        </Text>
      </Button>
    </Pressable>
  );
}
