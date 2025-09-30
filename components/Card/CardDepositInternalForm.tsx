import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address } from 'viem';
import { fuse } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { z } from 'zod';

import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import useBridgeToCard from '@/hooks/useBridgeToCard';
import { useCardDetails } from '@/hooks/useCardDetails';
import useUser from '@/hooks/useUser';
import ERC20_ABI from '@/lib/abis/ERC20';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { Wallet as WalletIcon } from 'lucide-react-native';

type FormData = { amount: string; from: 'wallet' | 'savings' };

export default function CardDepositInternalForm() {
  const { user } = useUser();
  const { setTransaction } = useCardDepositStore();
  const { data: cardDetails } = useCardDetails();
  const [_from] = useState<'wallet' | 'savings'>('wallet');

  // Get Fuse USDC.e balance
  const { data: fuseUsdcBalance, isLoading: isBalanceLoading } = useReadContract({
    abi: ERC20_ABI,
    address: USDC_STARGATE,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: fuse.id,
    query: { enabled: !!user?.safeAddress },
  });

  const balanceAmount = fuseUsdcBalance ? Number(fuseUsdcBalance) / 1e6 : 0;

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} USDC.e`,
        ),
    });
  }, [balanceAmount]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: 'onChange',
    defaultValues: { amount: '', from: 'wallet' },
  });

  const watchedAmount = watch('amount');
  const formattedBalance = balanceAmount.toString();

  // Fuse bridge hook
  const { bridge, bridgeStatus, error: bridgeError } = useBridgeToCard();

  const onSubmit = async (data: any) => {
    try {
      // Check for Arbitrum funding address
      const arbitrumFundingAddress = cardDetails?.additional_funding_instructions?.find(
        instruction => instruction.chain === 'arbitrum',
      );

      if (!arbitrumFundingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Arbitrum deposits not available',
          text2: 'This card does not support Arbitrum deposits',
        });
        return;
      }

      const tx = await bridge(data.amount);

      Toast.show({
        type: 'success',
        text1: 'Deposit to card initiated',
        text2: `${data.amount} USDC.e bridged to card`,
        props: {
          link: `https://layerzeroscan.com/tx/${tx.transactionHash}`,
          linkText: 'View on LayerZeroScan',
          image: getTokenIcon({ tokenSymbol: 'USDC' }),
        },
      });

      setTransaction({ amount: Number(data.amount) });
      reset();
    } catch (error) {
      console.error('Bridge error:', error);
      Toast.show({
        type: 'error',
        text1: 'Bridge failed',
        text2: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const disabled = bridgeStatus === Status.PENDING || !formState.isValid || !watchedAmount;

  return (
    <View className="gap-6 flex-1">
      <View className="gap-2">
        <Text className="opacity-50 font-medium">From</Text>
        <View className="bg-accent rounded-2xl p-4 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <WalletIcon color="#A1A1A1" size={24} />
            <Text className="text-lg font-semibold">Fuse Wallet</Text>
          </View>
          <Text className="text-sm text-muted-foreground">USDC.e</Text>
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
              alt="USDC.e"
              style={{ width: 34, height: 34 }}
            />
            <Text className="font-semibold text-white text-lg">USDC.e</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <WalletIcon color="#A1A1A1" size={16} />
          {isBalanceLoading ? (
            <Skeleton className="w-20 h-5 rounded-md" />
          ) : (
            <Text className="text-muted-foreground">{formatNumber(balanceAmount)} USDC.e</Text>
          )}
          <Max
            onPress={() => {
              setValue('amount', formattedBalance);
              trigger('amount');
            }}
          />
        </View>
      </View>

      <View className="flex-1" />

      <View className="gap-2">
        <Text className="opacity-50 font-medium">To</Text>
        <View className="bg-accent rounded-2xl p-4 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-semibold">Card (Arbitrum)</Text>
          </View>
          <Text className="text-sm text-muted-foreground">USDC</Text>
        </View>
      </View>

      {bridgeError && (
        <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <Text className="text-red-500 text-sm">{bridgeError}</Text>
        </View>
      )}

      <Button
        variant="brand"
        className="rounded-2xl h-12"
        disabled={disabled}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-black text-lg">
          {bridgeStatus === Status.PENDING ? 'Depositing...' : 'Deposit to Card'}
        </Text>
      </Button>
    </View>
  );
}
