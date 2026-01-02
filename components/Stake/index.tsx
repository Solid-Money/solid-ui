import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { ArrowUp, Info, Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import Max from '@/components/Max';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { STAKE_MODAL } from '@/constants/modals';
import useBridgeToFuse from '@/hooks/useBridgeToFuse';
import useUser from '@/hooks/useUser';
import { useEthereumVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { useStakeStore } from '@/store/useStakeStore';

const Stake = () => {
  const { user } = useUser();
  const { setModal, setTransaction } = useStakeStore();

  const { data: ethereumBalance, isLoading: isEthereumBalanceLoading } = useEthereumVaultBalance(
    user?.safeAddress as Address,
  );

  // Create dynamic schema for withdraw form based on ethereum balance
  const stakeSchema = useMemo(() => {
    const balanceAmount = ethereumBalance || 0;
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
  }, [ethereumBalance]);

  type StakeFormData = { amount: string };

  const {
    control: stakeControl,
    handleSubmit: handleStakeSubmit,
    formState: { errors: stakeErrors, isValid: isStakeValid },
    watch: watchStake,
    reset: resetStake,
    setValue,
    trigger,
  } = useForm<StakeFormData>({
    resolver: zodResolver(stakeSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedStakeAmount = watchStake('amount');

  const { bridge, bridgeStatus } = useBridgeToFuse();
  const isStakeLoading = bridgeStatus === Status.PENDING;

  const getStakeText = () => {
    if (stakeErrors.amount) return stakeErrors.amount.message;
    if (bridgeStatus === Status.PENDING) return 'Depositing';
    if (bridgeStatus === Status.ERROR) return 'Error while Depositing';
    if (bridgeStatus === Status.SUCCESS) return 'Deposit Successful';
    if (!isStakeValid || !watchedStakeAmount) return 'Enter an amount';
    return 'Deposit';
  };

  const onStakeSubmit = async (data: StakeFormData) => {
    try {
      const transaction = await bridge(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
      resetStake(); // Reset form after successful transaction
      setModal(STAKE_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Deposit transaction completed',
        text2: `${data.amount} soUSD`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
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

  const isStakeFormDisabled = () => {
    return isStakeLoading || !isStakeValid || !watchedStakeAmount;
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="text-base opacity-60">Deposit amount</Text>

        <View
          className={cn(
            'w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3',
            stakeErrors.amount && 'border border-red-500',
          )}
        >
          <Controller
            control={stakeControl}
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
              />
            )}
          />
          <View className="flex-row items-center gap-2">
            <Image
              source={require('@/assets/images/sousd-4x.png')}
              alt="SoUSD"
              style={{ width: 34, height: 34 }}
            />
            <Text className="text-lg font-semibold text-white">SoUSD</Text>
          </View>
        </View>

        <Text className="flex items-center gap-1.5 text-left text-muted-foreground">
          <Wallet size={16} />{' '}
          {isEthereumBalanceLoading ? (
            <Skeleton className="h-4 w-16 rounded-md" />
          ) : ethereumBalance ? (
            `${formatNumber(ethereumBalance)} SoUSD`
          ) : (
            '0 SoUSD'
          )}
          <Max
            onPress={() => {
              setValue('amount', ethereumBalance?.toString() ?? '0');
              trigger('amount');
            }}
          />
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Info size={30} color="gray" />
        <Text className="text-sm text-muted-foreground">This action will deposit your funds.</Text>
      </View>

      <Button
        variant="brand"
        className="mt-32 h-12 rounded-2xl"
        onPress={handleStakeSubmit(onStakeSubmit)}
        disabled={isStakeFormDisabled()}
      >
        <Text className="text-lg font-semibold text-black">{getStakeText()}</Text>
        {isStakeLoading && <ActivityIndicator color="black" />}
      </Button>
    </View>
  );
};

const StakeTrigger = (props: any) => {
  return (
    <Button
      variant="outline"
      className={buttonVariants({
        variant: 'secondary',
        className: 'rounded-xl border-0 md:h-12 md:pr-6',
      })}
      {...props}
    >
      <View className="flex-row items-center gap-4">
        <ArrowUp color="white" />
        <Text className="text-base font-bold">Deposit</Text>
      </View>
    </Button>
  );
};

const StakeTitle = () => {
  return <Text className="text-2xl font-semibold">Deposit to earn rewards</Text>;
};

export { Stake, StakeTitle, StakeTrigger };
