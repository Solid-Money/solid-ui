import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { Address, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { z } from 'zod';

import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useActivityActions } from '@/hooks/useActivityActions';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { getChain } from '@/lib/thirdweb';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

const BASE_CHAIN_ID = 8453;
const BASE_USDC_ADDRESS = ADDRESSES.base.usdc as Address;

type FormData = { amount: string };

type Props = {
  agentEoaAddress: string;
  onSuccess: () => void;
};

const AgentDepositExternalForm = ({ agentEoaAddress, onSuccess }: Props) => {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const { createActivity, updateActivity } = useActivityActions();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);

  const eoaAddress = account?.address as Address | undefined;
  const { data: eoaTokenBalance, isLoading: isEOABalanceLoading } = useReadContract({
    abi: erc20Abi,
    address: BASE_USDC_ADDRESS,
    functionName: 'balanceOf',
    args: [eoaAddress as Address],
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!eoaAddress },
  });

  const formattedBalance = eoaTokenBalance ? formatUnits(eoaTokenBalance, 6) : '0';

  const schema = useMemo(() => {
    const balanceAmount = Number(formattedBalance);
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} USDC`,
        }),
    });
  }, [formattedBalance]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: 'onChange',
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');

  // Reset form on unmount.
  useEffect(() => () => reset(), [reset]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!account) {
        Toast.show({
          type: 'error',
          text1: 'Wallet not connected',
          text2: 'Please connect your wallet to continue',
        });
        return;
      }
      try {
        setSendStatus(Status.PENDING);

        const baseChain = getChain(BASE_CHAIN_ID);
        if (baseChain) {
          try {
            await switchChain(baseChain);
          } catch (chainError) {
            console.error('Failed to switch to Base:', chainError);
            Toast.show({
              type: 'error',
              text1: 'Network switch failed',
              text2: 'Please manually switch your wallet to Base mainnet.',
            });
            setSendStatus(Status.ERROR);
            return;
          }
        }

        const amountWei = parseUnits(data.amount, 6);
        const clientTxId = await createActivity({
          type: TransactionType.AGENT_WALLET_DEPOSIT,
          title: 'Deposit to Agent Wallet',
          shortTitle: 'Agent Deposit',
          amount: data.amount,
          symbol: 'USDC',
          chainId: BASE_CHAIN_ID,
          fromAddress: account.address,
          toAddress: agentEoaAddress,
          status: TransactionStatus.PENDING,
          metadata: {
            description: `Deposit ${data.amount} USDC to agent wallet from external wallet`,
            tokenAddress: BASE_USDC_ADDRESS,
          },
        });

        const tx = await account.sendTransaction({
          chainId: BASE_CHAIN_ID,
          to: BASE_USDC_ADDRESS,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [agentEoaAddress as Address, amountWei],
          }),
          value: 0n,
        });

        await updateActivity(clientTxId, {
          status: TransactionStatus.SUCCESS,
          hash: tx.transactionHash,
          url: `https://basescan.org/tx/${tx.transactionHash}`,
          metadata: { txHash: tx.transactionHash },
        });

        setSendStatus(Status.SUCCESS);
        Toast.show({
          type: 'success',
          text1: 'Deposit sent',
          text2: 'USDC transferred to your agent wallet on Base.',
          props: { badgeText: 'Success' },
        });
        reset();
        onSuccess();
      } catch (error) {
        setSendStatus(Status.ERROR);
        console.error('External agent deposit error:', error);
        Toast.show({
          type: 'error',
          text1: 'Deposit failed',
          text2: 'Please try again or check your wallet balance.',
        });
      }
    },
    [account, agentEoaAddress, switchChain, createActivity, updateActivity, reset, onSuccess],
  );

  const submitting = sendStatus === Status.PENDING;
  const disabled = submitting || !formState.isValid || !watchedAmount || !account;

  return (
    <View className="flex-1 gap-6">
      <View className="gap-2">
        <Text className="font-medium opacity-50">From wallet</Text>
        <ConnectedWalletDropdown chainId={BASE_CHAIN_ID} />
      </View>

      <View className="gap-2">
        <Text className="font-medium opacity-50">Deposit amount</Text>
        <View
          className={cn(
            'w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3',
            formState.errors.amount && 'border border-red-500',
          )}
        >
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                keyboardType="decimal-pad"
                className="min-w-0 flex-1 text-2xl font-semibold text-white web:focus:outline-none"
                value={value}
                placeholder="0.0"
                placeholderTextColor="#666"
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View className="shrink-0 flex-row items-center gap-2">
            <Image
              source={getAsset('images/usdc-4x.png')}
              alt="USDC"
              style={{ width: 34, height: 34 }}
            />
            <Text className="text-lg font-semibold text-white">USDC</Text>
          </View>
        </View>
        {formState.errors.amount && (
          <Text className="mt-1 text-sm text-red-500">{formState.errors.amount.message}</Text>
        )}
        <View className="flex-row items-center gap-2">
          <WalletIcon color="#A1A1A1" size={16} />
          {isEOABalanceLoading ? (
            <Skeleton className="h-5 w-20 rounded-md" />
          ) : (
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedBalance))} USDC
            </Text>
          )}
          <Max
            onPress={() => {
              setValue('amount', formattedBalance);
              trigger('amount');
            }}
          />
        </View>
        <Text className="text-xs text-muted-foreground">
          Sends USDC directly on Base. Funds arrive at your agent wallet immediately and do not earn
          yield — borrow against savings instead if you want to keep yield on the principal.
        </Text>
      </View>

      <View className="flex-1" />

      <Button
        variant="brand"
        className="h-12 rounded-2xl"
        disabled={disabled}
        onPress={() => handleSubmit(onSubmit)()}
      >
        {submitting ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="native:text-lg text-base font-bold text-black">Deposit</Text>
        )}
      </Button>
    </View>
  );
};

export default AgentDepositExternalForm;
