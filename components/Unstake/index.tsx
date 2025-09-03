import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { ArrowDownLeft, Info, Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import Max from '@/components/Max';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { UNSTAKE_MODAL } from '@/constants/modals';
import useBridgeToMainnet from '@/hooks/useBridgeToMainnet';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const Unstake = () => {
  const { user } = useUser();
  const { setModal, setTransaction } = useUnstakeStore();

  const { data: fuseBalance, isLoading: isFuseBalanceLoading } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );

  // Create dynamic schema for bridge form based on fuse balance
  const bridgeSchema = useMemo(() => {
    const balanceAmount = fuseBalance || 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} soUSD`,
        )
        .transform(val => Number(val)),
    });
  }, [fuseBalance]);

  type BridgeFormData = { amount: string };

  const {
    control: bridgeControl,
    handleSubmit: handleBridgeSubmit,
    formState: { errors: bridgeErrors, isValid: isBridgeValid },
    watch: watchBridge,
    reset: resetBridge,
    setValue,
    trigger,
  } = useForm<BridgeFormData>({
    resolver: zodResolver(bridgeSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedBridgeAmount = watchBridge('amount');

  const { bridge, bridgeStatus } = useBridgeToMainnet();
  const isBridgeLoading = bridgeStatus === Status.PENDING;

  const getBridgeText = () => {
    if (bridgeErrors.amount) return bridgeErrors.amount.message;
    if (bridgeStatus === Status.PENDING) return 'Unstaking';
    if (bridgeStatus === Status.ERROR) return 'Error while unstaking';
    if (bridgeStatus === Status.SUCCESS) return 'Successfully Unstaked';
    if (!isBridgeValid || !watchedBridgeAmount) return 'Enter an amount';
    return 'Unstake';
  };

  const onBridgeSubmit = async (data: BridgeFormData) => {
    try {
      const transaction = await bridge(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
      resetBridge(); // Reset form after successful transaction
      setModal(UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Unstake transaction submitted',
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
        text1: 'Error while unstaking',
      });
    }
  };

  const isBridgeFormDisabled = () => {
    return isBridgeLoading || !isBridgeValid || !watchedBridgeAmount;
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="opacity-60">Unstake amount</Text>

        <View
          className={cn(
            'w-full bg-accent rounded-2xl px-5 py-3',
            bridgeErrors.amount && 'border border-red-500',
          )}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Controller
            control={bridgeControl}
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
              source={require('@/assets/images/sousd-4x.png')}
              alt="SoUSD"
              style={{ width: 34, height: 34 }}
            />
            <Text className="font-semibold text-white text-lg native:text-sm web:text-base">
              SoUSD
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Wallet size={16} color="#666" />
          <Text className="text-muted-foreground text-sm">
            {isFuseBalanceLoading ? (
              <Skeleton className="w-16 h-4 rounded-md" />
            ) : fuseBalance ? (
              `${formatNumber(fuseBalance)} SoUSD`
            ) : (
              '0 SoUSD'
            )}
          </Text>
          <Max
            onPress={() => {
              setValue('amount', fuseBalance?.toString() ?? '0');
              trigger('amount');
            }}
          />
        </View>
      </View>

      <View className="flex-row gap-2">
        <Info size={30} color="gray" />
        <Text className="text-sm text-muted-foreground">
          This action will unstake your funds, and allow you to withdraw and send them to another
          wallet
        </Text>
      </View>

      <Button
        variant="brand"
        className="rounded-2xl h-12 mt-32"
        onPress={handleBridgeSubmit(onBridgeSubmit)}
        disabled={isBridgeFormDisabled()}
      >
        <Text className="font-semibold text-black text-lg">{getBridgeText()}</Text>
        {isBridgeLoading && <ActivityIndicator color="black" />}
      </Button>
    </View>
  );
};

const UnstakeTrigger = (props: any) => {
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
        <ArrowDownLeft color="white" />
        <Text className="hidden md:block font-bold">Unstake</Text>
      </View>
    </Button>
  );
};

const UnstakeTitle = () => {
  return <Text className="text-2xl font-semibold">Unstake from savings</Text>;
};

export { Unstake, UnstakeTitle, UnstakeTrigger };
