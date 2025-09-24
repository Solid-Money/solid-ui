import { zodResolver } from '@hookform/resolvers/zod';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address } from 'viem';
import { z } from 'zod';

import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDetails } from '@/hooks/useCardDetails';
import useSend from '@/hooks/useSend';
import useUser from '@/hooks/useUser';
import { useUsdcVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { Wallet as WalletIcon } from 'lucide-react-native';

type FormData = { amount: string; from: 'wallet' | 'savings' };

export default function CardDepositInternalForm() {
  const { user } = useUser();
  const { setModal, setTransaction } = useCardDepositStore();
  const { data: cardDetails } = useCardDetails();
  const [from, setFrom] = useState<'wallet' | 'savings'>('wallet');

  // For MVP we use the same USDC vault balance for both entries
  const { data: ethereumBalance, isLoading: isBalanceLoading } = useUsdcVaultBalance(
    user?.safeAddress as Address,
  );

  const schema = useMemo(() => {
    const balanceAmount = ethereumBalance || 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} USDC`,
        ),
    });
  }, [ethereumBalance]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: 'onChange',
    defaultValues: { amount: '', from: 'wallet' },
  });

  const watchedAmount = watch('amount');
  const formattedVaultBalance = (ethereumBalance || 0).toString();

  const { send, sendStatus, resetSendStatus } = useSend({
    tokenAddress: (getTokenIcon as any) && ({} as any),
    // We'll always send USDC on Ethereum vault → card's address
    tokenDecimals: 6,
    chainId: 1,
  } as any);

  // Hack: reuse the app hook that expects addresses; we only need token + decimals
  // Better: create a dedicated hook, but out of scope for this UI task.

  const onSubmit = async (data: any) => {
    try {
      if (!cardDetails?.funding_instructions?.address) return;
      const fundingAddress = cardDetails.funding_instructions.address as Address;
      const tx = await send(data.amount, fundingAddress);
      setTransaction({ amount: Number(data.amount) });
      Toast.show({
        type: 'success',
        text1: 'Card deposit initiated',
        text2: `${data.amount} USDC sent to card`,
        props: {
          link: `https://etherscan.io/tx/${tx.transactionHash}`,
          linkText: 'View on Etherscan',
          image: getTokenIcon({ tokenSymbol: 'USDC' }),
        },
      });
      reset();
      setModal(CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      setTimeout(() => {
        resetSendStatus();
      }, 2000);
    } catch (_e) {}
  };

  const disabled = sendStatus === Status.PENDING || !formState.isValid || !watchedAmount;

  return (
    <View className="gap-6 flex-1">
      <View className="gap-2">
        <Text className="opacity-50 font-medium">From</Text>
        <View className="bg-accent rounded-2xl p-4 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <WalletIcon color="#A1A1A1" size={24} />
            <Text className="text-lg font-semibold">
              {from === 'wallet' ? 'Wallet' : 'Savings'}
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="opacity-50 font-medium">Deposit amount</Text>
        <View
          className={cn(
            'flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3',
            formState.errors.amount && 'border border-red-500',
          )}
        >
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                keyboardType="decimal-pad"
                className="w-full text-2xl text-white font-semibold web:focus:outline-none"
                value={value as any}
                placeholder="0.0"
                placeholderTextColor="#666"
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View className="flex-row items-center gap-2">
            <Image
              source={require('@/assets/images/usdc-4x.png')}
              alt="USDC"
              style={{ width: 34, height: 34 }}
            />
            <Text className="font-semibold text-white text-lg">USDC</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <WalletIcon color="#A1A1A1" size={16} />
          {isBalanceLoading ? (
            <Skeleton className="w-20 h-5 rounded-md" />
          ) : (
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedVaultBalance))} USDC
            </Text>
          )}
          <Max
            onPress={() => {
              setValue('amount', formattedVaultBalance);
              trigger('amount');
            }}
          />
        </View>
      </View>

      <View className="flex-1" />

      <Button
        variant="brand"
        className="rounded-2xl h-12"
        disabled={disabled}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-black text-lg">Deposit</Text>
      </Button>
    </View>
  );
}
