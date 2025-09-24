import { zodResolver } from '@hookform/resolvers/zod';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address, encodeFunctionData, formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useCardDetails } from '@/hooks/useCardDetails';
import ERC20_ABI from '@/lib/abis/ERC20';
import { ADDRESSES } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { useActiveAccount } from 'thirdweb/react';
import { useReadContract } from 'wagmi';

type FormData = { amount: string };

export default function CardDepositExternalForm() {
  const account = useActiveAccount();
  const { setModal, setTransaction } = useCardDepositStore();
  const { data: cardDetails } = useCardDetails();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);

  const eoaAddress = account?.address as Address | undefined;
  const { data: eoaUsdcBalance, isLoading: isEOABalanceLoading } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: 1,
    query: { enabled: !!eoaAddress },
  });

  const schema = useMemo(() => {
    const balanceAmount = eoaUsdcBalance ? Number(formatUnits(eoaUsdcBalance, 6)) : 0;
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
  }, [eoaUsdcBalance]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: 'onChange',
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');
  const formattedEOABalance = eoaUsdcBalance ? formatUnits(eoaUsdcBalance, 6) : '0';

  const resetSendStatus = () => {
    setSendStatus(Status.IDLE);
  };

  const onSubmit = async (data: any) => {
    try {
      if (!cardDetails?.funding_instructions?.address || !account) return;

      setSendStatus(Status.PENDING);
      const fundingAddress = cardDetails.funding_instructions.address as Address;
      const amountWei = parseUnits(data.amount, 6);

      // Send USDC transfer transaction from external wallet directly to card funding address
      const tx = await account.sendTransaction({
        chainId: 1, // Ethereum mainnet
        to: ADDRESSES.ethereum.usdc,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [fundingAddress, amountWei],
        }),
        value: 0n,
      });

      setSendStatus(Status.SUCCESS);
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
    } catch (error) {
      setSendStatus(Status.ERROR);
      console.error('External wallet deposit error:', error);
      Toast.show({
        type: 'error',
        text1: 'Deposit failed',
        text2: 'Please try again or check your wallet balance',
      });
    }
  };

  const disabled = sendStatus === Status.PENDING || !formState.isValid || !watchedAmount;

  return (
    <View className="gap-6 flex-1 justify-between">
      <View className="gap-2">
        <Text className="opacity-50 font-medium">From wallet</Text>
        <ConnectedWalletDropdown chainId={1} />
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
          {isEOABalanceLoading ? (
            <Skeleton className="w-20 h-5 rounded-md" />
          ) : (
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedEOABalance))} USDC
            </Text>
          )}
          <Max
            onPress={() => {
              setValue('amount', formattedEOABalance);
              trigger('amount');
            }}
          />
        </View>
      </View>

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
