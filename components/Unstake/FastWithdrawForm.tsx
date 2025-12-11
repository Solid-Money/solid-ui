import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import { CheckConnectionWrapper } from '@/components/CheckConnectionWrapper';
import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL, UNSTAKE_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import useDebounce from '@/hooks/useDebounce';
import useFastWithdraw from '@/hooks/useFastWithdraw';
import useFastWithdrawAndBridge from '@/hooks/useFastWithdrawAndBridge';
import { usePreviewFastWithdraw } from '@/hooks/usePreviewFastWithdraw';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { ADDRESSES } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { isAddress, TransactionReceipt } from 'viem';

const FastWithdrawForm = () => {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivity();
  const { setModal, setTransaction, selectedNetwork } = useUnstakeStore();

  const chainId = useMemo(() => {
    if (!selectedNetwork) return undefined;
    const entry = Object.entries(BRIDGE_TOKENS).find(([_, n]) => n === selectedNetwork);
    return entry ? Number(entry[0]) : undefined;
  }, [selectedNetwork]);

  const { data: formattedBalance } = useFuseVaultBalance(user?.safeAddress as Address);

  const withdrawSchema = useMemo(() => {
    const balanceAmount = formattedBalance ? Number(formattedBalance) : 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(val => Number(val) >= 5, 'Amount must be at least 5 soUSD')
        .refine(val => Number(val) <= 1000, 'Amount must be at most 1000 soUSD')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} soUSD`,
        )
        .transform(val => Number(val)),
      address: z
        .string()
        .min(1, 'Address is required')
        .refine(isAddress, 'Please enter a valid Ethereum address'),
    });
  }, [formattedBalance]);

  type WithdrawFormData = { amount: string; address: string };

  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
    watch,
    setValue,
    trigger,
    reset,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
      address: '',
    },
  });

  const watchedAmount = watch('amount');
  const debouncedAmount = useDebounce(watchedAmount, 500);

  const { amountOut: previewData, isLoading: isPreviewLoading } = usePreviewFastWithdraw(
    debouncedAmount,
    ADDRESSES.fuse.stargateOftUSDC,
    chainId ?? 0,
  );

  const { fastWithdrawAndBridge, fastWithdrawStatus: fastWithdrawAndBridgeStatus } =
    useFastWithdrawAndBridge();
  const { fastWithdraw, fastWithdrawStatus: fastWithdrawStatus } = useFastWithdraw();

  const isLoading =
    fastWithdrawAndBridgeStatus === Status.PENDING || fastWithdrawStatus === Status.PENDING;

  const onSubmit = async (data: any) => {
    if (!user) return;

    try {
      // Create activity event (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.FAST_WITHDRAW,
        title: `Fast Withdraw`,
        shortTitle: `Fast Withdraw`,
        amount: data.amount,
        symbol: 'soUSD',
        chainId: chainId ?? 0,
        fromAddress: user.safeAddress,
        toAddress: data.address,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Withdraw ${data.amount} soUSD to ${data.address}`,
          processingStatus: chainId === 122 ? 'fast_withdraw' : 'bridging',
        },
      });

      let tx: TransactionReceipt | undefined;

      if (chainId === 122) {
        tx = await fastWithdraw(data.amount.toString(), data.address);
        await updateActivity(clientTxId, {
          status: TransactionStatus.SUCCESS,
          hash: tx.transactionHash,
          url: `https://explorer.fuse.io/tx/${tx.transactionHash}`,
          metadata: {
            txHash: tx.transactionHash,
            processingStatus: 'fast_withdraw',
          },
        });
        Toast.show({
          type: 'success',
          text1: 'Fast withdraw transaction completed',
          text2: `${data.amount} soUSD`,
          props: {
            link: `https://explorer.fuse.io/tx/${tx.transactionHash}`,
            linkText: eclipseAddress(tx.transactionHash),
            image: getTokenIcon({ tokenSymbol: 'SoUSD' }),
          },
        });
      } else {
        tx = await fastWithdrawAndBridge(
          data.amount.toString(),
          previewData?.minAmountOut?.toString() ?? '0',
          data.address,
          chainId ?? 0,
        );

        // Update activity with transaction hash, keeping it PENDING
        await updateActivity(clientTxId, {
          status: TransactionStatus.PENDING,
          hash: tx.transactionHash,
          url: `https://layerzeroscan.com/tx/${tx.transactionHash}`,
          metadata: {
            txHash: tx.transactionHash,
            processingStatus: chainId === 122 ? 'fast_withdraw' : 'awaiting_bridge',
          },
        });
        Toast.show({
          type: 'success',
          text1: 'Withdraw transaction submitted',
          text2: `${data.amount} soUSD`,
          props: {
            link: `https://layerzeroscan.com/tx/${tx.transactionHash}`,
            linkText: eclipseAddress(tx.transactionHash),
            image: getTokenIcon({ tokenSymbol: 'SoUSD' }),
          },
        });
      }

      setTransaction({ amount: Number(data.amount) });
      setModal(UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS);
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

  const isFormDisabled = () => {
    return isPreviewLoading || !isValid || !watchedAmount;
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-muted-foreground text-base">Destination address</Text>
          <View className="px-5 py-4 bg-accent rounded-2xl flex-row items-center justify-between gap-2 w-full">
            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="default"
                  className="w-full text-2xl text-white font-semibold web:focus:outline-none"
                  value={value.toString()}
                  placeholder="0x..."
                  placeholderTextColor="#666"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                  onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                />
              )}
            />
          </View>
          {errors.address && (
            <Text className="text-red-500 text-sm mt-1">{errors.address.message}</Text>
          )}
        </View>
        <View className="gap-2">
          <Text className="text-muted-foreground text-base">Amount</Text>
          <View className="px-5 py-4 bg-accent rounded-2xl flex-row items-center justify-between gap-2 w-full">
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="decimal-pad"
                  className="w-full text-2xl text-white font-semibold web:focus:outline-none"
                  value={value.toString()}
                  placeholder="0.0"
                  placeholderTextColor="#666"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="done"
                  onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                />
              )}
            />
            <View className="flex-row items-center gap-2 flex-shrink-0">
              <Pressable
                onPress={() => setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                className="flex-row items-center gap-2"
              >
                <Image
                  source={require('@/assets/images/sousd-4x.png')}
                  alt="soUSD"
                  style={{ width: 32, height: 32 }}
                />
                <Text className="font-semibold text-white text-lg">soUSD</Text>
              </Pressable>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Wallet color="#A1A1A1" size={16} />
            <Text className="text-base text-muted-foreground">
              {formatNumber(Number(formattedBalance))} soUSD
            </Text>
            <Max
              onPress={() => {
                setValue('amount', formattedBalance?.toString() ?? '0');
                trigger('amount');
              }}
            />
          </View>
          {errors.amount && (
            <Text className="text-red-500 text-sm mt-1">{errors.amount.message}</Text>
          )}
        </View>
        <TokenDetails>
          <View className="px-5 py-6 md:p-5 flex-row items-center justify-between gap-2 md:gap-10">
            <View className="flex-row items-center gap-2">
              <Text className="text-base text-muted-foreground">Network</Text>
            </View>
            <View className="flex-row items-center gap-2 ml-auto flex-shrink-0">
              <Image source={selectedNetwork?.icon} style={{ width: 24, height: 24 }} />
              <Text className="text-base font-semibold">{selectedNetwork?.name}</Text>
            </View>
          </View>
          <View className="px-5 py-6 md:p-5 flex-row items-center justify-between gap-2 md:gap-10">
            <Text className="text-base text-muted-foreground">Estimated Receive</Text>
            <View className="flex-row items-baseline gap-2 ml-auto flex-shrink-0">
              {isPreviewLoading ? (
                <Skeleton className="w-20 h-7 bg-white/20" />
              ) : (
                <Text className="text-base font-semibold">
                  {formatNumber(Number(previewData?.minAmountOut ?? 0) / 1e6)} USDC
                </Text>
              )}
            </View>
          </View>
          <View className="px-5 py-6 md:p-5 flex-row items-center justify-between gap-2 md:gap-10">
            <Text className="text-base text-muted-foreground">Estimated Time</Text>
            <View className="flex-row items-baseline gap-2 ml-auto flex-shrink-0">
              {selectedNetwork?.name === 'Fuse' ? (
                <Text className="text-base font-semibold">Instant</Text>
              ) : (
                <Text className="text-base font-semibold">2 - 10 Minutes</Text>
              )}
            </View>
          </View>
          <View className="px-5 py-6 md:p-5 flex-row items-center justify-between gap-2 md:gap-10">
            <Text className="text-base text-muted-foreground">Fee</Text>
            <View className="flex-row items-baseline gap-2 ml-auto flex-shrink-0">
              {isPreviewLoading ? (
                <Skeleton className="w-20 h-7 bg-white/20" />
              ) : (
                <Text className="text-base font-semibold">{`$${formatNumber(
                  Number(
                    (previewData?.amountOutBeforePremium ?? 0n) -
                      (previewData?.minAmountOut ?? 0n) +
                      (previewData?.feeAmount ?? 0n),
                  ) / 1e6,
                )}`}</Text>
              )}
            </View>
          </View>
        </TokenDetails>
        <CheckConnectionWrapper props={{ size: 'xl' }}>
          <Button
            variant="brand"
            className="rounded-2xl h-12"
            onPress={handleSubmit(onSubmit)}
            disabled={isFormDisabled()}
          >
            <Text className="text-base font-semibold">Withdraw</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>
        </CheckConnectionWrapper>
      </View>
    </Pressable>
  );
};

export default FastWithdrawForm;
