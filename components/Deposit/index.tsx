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
import { DEPOSIT_FROM_SAFE_ACCOUNT_MODAL } from '@/constants/modals';
import useDeposit from '@/hooks/useDeposit';
import useUser from '@/hooks/useUser';
import { useUsdcVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { useStakeStore } from '@/store/useStakeStore';

const Deposit = () => {
  const { user } = useUser();
  const { setModal, setTransaction } = useStakeStore();

  const { data: ethereumBalance, isLoading: isEthereumBalanceLoading } = useUsdcVaultBalance(
    user?.safeAddress as Address,
  );

  // Create dynamic schema for withdraw form based on ethereum balance
  const depositSchema = useMemo(() => {
    const balanceAmount = ethereumBalance || 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} USDC`,
        )
        .transform(val => Number(val)),
    });
  }, [ethereumBalance]);

  type DepositFormData = { amount: string };

  const {
    control: depositControl,
    handleSubmit: handleDepositSubmit,
    formState: { errors: depositErrors, isValid: isDepositValid },
    watch: watchDeposit,
    reset: resetDeposit,
    setValue,
    trigger,
  } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedDepositAmount = watchDeposit('amount');

  const { deposit, depositStatus } = useDeposit();
  const isDepositLoading = depositStatus === Status.PENDING;

  const getDepositText = () => {
    if (depositErrors.amount) return depositErrors.amount.message;
    if (depositStatus === Status.PENDING) return 'Depositing';
    if (depositStatus === Status.ERROR) return 'Error while Depositing';
    if (depositStatus === Status.SUCCESS) return 'Deposit Successful';
    if (!isDepositValid || !watchedDepositAmount) return 'Enter an amount';
    return 'Deposit';
  };

  const onDepositSubmit = async (data: DepositFormData) => {
    try {
      const transaction = await deposit(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
      resetDeposit(); // Reset form after successful transaction
      setModal(DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Deposit transaction completed',
        text2: `${data.amount} USDC`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({ tokenSymbol: 'USDC' }),
        },
      });
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Error while depositing',
      });
    }
  };

  const isDepositFormDisabled = () => {
    return isDepositLoading || !isDepositValid || !watchedDepositAmount;
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="opacity-60">Deposit amount</Text>

        <View
          className={cn(
            'flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3',
            depositErrors.amount && 'border border-red-500',
          )}
        >
          <Controller
            control={depositControl}
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

        <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
          <Wallet size={16} />{' '}
          {isEthereumBalanceLoading ? (
            <Skeleton className="w-16 h-4 rounded-md" />
          ) : ethereumBalance ? (
            `${formatNumber(ethereumBalance)} USDC`
          ) : (
            '0 USDC'
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
        className="rounded-2xl h-12 mt-32"
        onPress={handleDepositSubmit(onDepositSubmit)}
        disabled={isDepositFormDisabled()}
      >
        <Text className="font-semibold text-black text-lg">{getDepositText()}</Text>
        {isDepositLoading && <ActivityIndicator color="black" />}
      </Button>
    </View>
  );
};

const DepositTrigger = (props: any) => {
  return (
    <Button
      variant="outline"
      className={buttonVariants({
        variant: 'secondary',
        className: 'border-0 md:h-12 md:pr-6 rounded-xl',
      })}
      {...props}
    >
      <View className="flex-row items-center gap-4">
        <ArrowUp color="white" />
        <Text className="hidden md:block font-bold">Deposit</Text>
      </View>
    </Button>
  );
};

const DepositTitle = () => {
  return <Text className="text-2xl font-semibold">Deposit to earn rewards</Text>;
};

export { Deposit, DepositTitle, DepositTrigger };
