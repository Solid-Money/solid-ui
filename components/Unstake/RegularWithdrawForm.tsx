import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { Info, Wallet } from 'lucide-react-native';
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

import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL, UNSTAKE_MODAL } from '@/constants/modals';
import useBridgeToMainnet from '@/hooks/useBridgeToMainnet';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const RegularWithdrawForm = () => {
  const { user } = useUser();
  const { setModal, setTransaction } = useUnstakeStore();

  const { data: formattedBalance, isLoading: isLoadingFuseBalance } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );

  const bridgeSchema = useMemo(() => {
    const balanceAmount = formattedBalance ? Number(formattedBalance) : 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Please enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} soUSD`,
        })
        .transform(val => Number(val)),
    });
  }, [formattedBalance]);

  type WithdrawFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { isValid: isBridgeValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(bridgeSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedAmount = watch('amount');
  const { bridge, bridgeStatus } = useBridgeToMainnet();
  const isBridgeLoading = bridgeStatus === Status.PENDING;

  const onBridgeSubmit = async (data: WithdrawFormData) => {
    try {
      const transaction = await bridge(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
      reset(); // Reset form after successful transaction
      setModal(UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Withdraw transaction submitted',
        text2: `${data.amount} soUSD`,
        props: {
          link: `https://layerzeroscan.com/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({ tokenSymbol: 'SoUSD' }),
        },
      });
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Error while withdrawing',
      });
    }
  };

  const isWithdrawFormDisabled = () => {
    return isLoadingFuseBalance || !isBridgeValid || !watchedAmount || isBridgeLoading;
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-base text-muted-foreground">Amount</Text>
          <View className="w-full flex-row items-center justify-between gap-2 rounded-2xl bg-accent px-5 py-4">
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="decimal-pad"
                  className="w-full text-2xl font-semibold text-white web:focus:outline-none"
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
            <View className="flex-shrink-0 flex-row items-center gap-2">
              <Pressable
                onPress={() => setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                className="flex-row items-center gap-2"
              >
                <Image
                  source={require('@/assets/images/sousd-4x.png')}
                  alt="soUSD"
                  style={{ width: 32, height: 32 }}
                />
                <Text className="text-lg font-semibold text-white">soUSD</Text>
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
        </View>
        <TokenDetails>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <View className="flex-row items-center gap-2">
              <Text className="text-base text-muted-foreground">Destination</Text>
            </View>
            <View className="ml-auto flex-shrink-0 flex-row items-center gap-2">
              <Wallet size={24} color="white" />
              <Text className="text-base font-semibold">Wallet</Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Estimated Time</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              {isLoadingFuseBalance ? (
                <Skeleton className="h-7 w-20 bg-white/20" />
              ) : (
                <Text className="text-base font-semibold">Up to 24 hours</Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Fee</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-base font-semibold">{`$${formatNumber(0)}`}</Text>
            </View>
          </View>
        </TokenDetails>

        {/* Info Card */}
        <View className="flex-row items-start gap-3 rounded-[15px] bg-primary/5 p-4">
          <Info size={20} color="white" className="mt-1" />
          <Text className="flex-1 text-base leading-[20px] text-muted-foreground">
            This action will move your token from the savings account to your wallet allowing you to
            withdraw it from the homepage (takes 2-3 min)
          </Text>
        </View>

        <Button
          variant="brand"
          className="mt-2 h-[54px] rounded-[15px]"
          onPress={handleSubmit(onBridgeSubmit)}
          disabled={isWithdrawFormDisabled()}
        >
          {isBridgeLoading ? (
            <ActivityIndicator color="gray" />
          ) : (
            <Text className="text-lg font-bold text-primary-foreground">Withdraw</Text>
          )}
          {isBridgeLoading && <ActivityIndicator color="black" />}
        </Button>

        <View className="mt-2 flex-row items-center justify-center gap-2">
          <View className="h-4 w-4 items-center justify-center rounded-full border border-muted-foreground">
            <Text className="text-[10px] text-muted-foreground">?</Text>
          </View>
          <Text className="text-base font-medium text-muted-foreground">Need help?</Text>
        </View>
      </View>
    </Pressable>
  );
};

export default RegularWithdrawForm;
