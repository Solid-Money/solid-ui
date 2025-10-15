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
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useCardDetails } from '@/hooks/useCardDetails';
import useUser from '@/hooks/useUser';
import ERC20_ABI from '@/lib/abis/ERC20';
import { getChain } from '@/lib/thirdweb';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { arbitrum } from 'viem/chains';
import { useReadContract } from 'wagmi';

type FormData = { amount: string };

export default function CardDepositExternalForm() {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivity();
  const { setTransaction, setModal } = useCardDepositStore();
  const { data: cardDetails } = useCardDetails();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);

  const eoaAddress = account?.address as Address | undefined;
  const arbitrumUsdcAddress = BRIDGE_TOKENS[arbitrum.id]?.tokens?.USDC?.address as Address;
  const { data: eoaUsdcBalance, isLoading: isEOABalanceLoading } = useReadContract({
    abi: ERC20_ABI,
    address: arbitrumUsdcAddress,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: arbitrum.id,
    query: { enabled: !!eoaAddress && !!arbitrumUsdcAddress },
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
    const arbitrumFundingAddress = cardDetails?.additional_funding_instructions?.find(
      instruction => instruction.chain === 'arbitrum',
    );

    try {
      if (!arbitrumFundingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Arbitrum deposits not available',
          text2: 'This card does not support Arbitrum deposits',
        });
        return;
      }

      if (!account) {
        Toast.show({
          type: 'error',
          text1: 'Wallet not connected',
          text2: 'Please connect your wallet to continue',
        });
        return;
      }

      if (!arbitrumUsdcAddress) {
        Toast.show({
          type: 'error',
          text1: 'Configuration error',
          text2: 'Arbitrum USDC address not found',
        });
        return;
      }

      if (!user) {
        Toast.show({
          type: 'error',
          text1: 'User not authenticated',
          text2: 'Please refresh and try again',
        });
        return;
      }

      setSendStatus(Status.PENDING);
      const fundingAddress = arbitrumFundingAddress.address as Address;
      const amountWei = parseUnits(data.amount, 6);

      try {
        const arbitrumChain = getChain(arbitrum.id);
        if (arbitrumChain) {
          await switchChain(arbitrumChain);
        }
      } catch (chainError) {
        console.error('Failed to switch to Arbitrum:', chainError);
        Toast.show({
          type: 'error',
          text1: 'Network switch failed',
          text2: 'Please manually switch your wallet to Arbitrum',
        });
        setSendStatus(Status.ERROR);
        return;
      }

      // Create activity event (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.CARD_TRANSACTION,
        title: `Card Deposit`,
        shortTitle: `Card Deposit`,
        amount: data.amount,
        symbol: 'USDC',
        chainId: arbitrum.id,
        fromAddress: account.address,
        toAddress: fundingAddress,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Deposit ${data.amount} USDC to card from external wallet`,
          processingStatus: 'sending',
        },
      });

      // Send USDC transfer transaction from external wallet directly to card funding address
      const tx = await account.sendTransaction({
        chainId: arbitrum.id, // Arbitrum
        to: arbitrumUsdcAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [fundingAddress, amountWei],
        }),
        value: 0n,
      });

      // Update activity with transaction hash, keeping it PENDING
      await updateActivity(clientTxId, {
        status: TransactionStatus.PENDING,
        hash: tx.transactionHash,
        url: `https://arbiscan.io/tx/${tx.transactionHash}`,
        metadata: {
          txHash: tx.transactionHash,
          processingStatus: 'awaiting_bridge',
        },
      });

      setSendStatus(Status.SUCCESS);
      setTransaction({ amount: Number(data.amount) });
      setModal(CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      reset();

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
    <View className="gap-6 flex-1">
      <View className="gap-2">
        <Text className="opacity-50 font-medium">From wallet</Text>
        <ConnectedWalletDropdown chainId={arbitrum.id} />
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
        {formState.errors.amount && (
          <Text className="text-red-500 text-sm mt-1">{formState.errors.amount.message}</Text>
        )}
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

      <View className="flex-1" />

      <Button
        variant="brand"
        className="rounded-2xl h-12"
        disabled={disabled}
        onPress={() => {
          if (!account) {
            Toast.show({
              type: 'error',
              text1: 'Wallet not connected',
              text2: 'Please connect your wallet to Arbitrum',
            });
            return;
          }

          if (!watchedAmount || watchedAmount === '') {
            Toast.show({
              type: 'error',
              text1: 'Enter amount',
              text2: 'Please enter a deposit amount',
            });
            return;
          }

          if (!formState.isValid) {
            const errorMessage = formState.errors.amount?.message;
            Toast.show({
              type: 'error',
              text1: 'Invalid amount',
              text2: errorMessage || 'Please check your deposit amount',
            });
            return;
          }

          if (sendStatus === Status.PENDING) {
            Toast.show({
              type: 'info',
              text1: 'Transaction in progress',
              text2: 'Please wait for the current transaction to complete',
            });
            return;
          }

          handleSubmit(onSubmit)();
        }}
      >
        <Text className="font-semibold text-black text-lg">
          {sendStatus === Status.PENDING ? 'Processing...' : 'Deposit'}
        </Text>
      </Button>
    </View>
  );
}
