import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Fuel, Wallet } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { formatUnits } from 'viem';
import { z } from 'zod';

import { CheckConnectionWrapper } from '@/components/CheckConnectionWrapper';
import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { explorerUrls, layerzero, lifi } from '@/constants/explorers';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useTotalAPY } from '@/hooks/useAnalytics';
import useDepositFromEOA, { DepositStatus } from '@/hooks/useDepositFromEOA';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import TooltipPopover from '@/components/Tooltip';

function DepositToVaultForm() {
  const { balance, deposit, depositStatus, hash, isEthereum } = useDepositFromEOA();
  const { setModal, setTransaction, srcChainId } = useDepositStore();

  const isLoading =
    depositStatus === DepositStatus.PENDING ||
    depositStatus === DepositStatus.DEPOSITING ||
    depositStatus === DepositStatus.BRIDGING;
  const { data: totalAPY } = useTotalAPY();

  const formattedBalance = balance ? formatUnits(balance, 6) : '0';

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, 6)) : 0;

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
  }, [balance]);

  type DepositFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedAmount = watch('amount');
  const isSponsor = Number(watchedAmount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT);
  const {
    amountOut,
    isLoading: isPreviewDepositLoading,
    exchangeRate,
  } = usePreviewDeposit(watchedAmount || '0');

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (depositStatus === DepositStatus.PENDING) return 'Check Wallet';
    if (depositStatus === DepositStatus.DEPOSITING) return 'Depositing (takes 2mins)';
    if (depositStatus === DepositStatus.BRIDGING) return 'Bridging (takes 2mins)';
    if (depositStatus === DepositStatus.SUCCESS)
      return isEthereum ? 'Successfully deposited!' : 'Successfully bridged!';
    if (depositStatus === DepositStatus.ERROR)
      return isEthereum ? 'Error while depositing' : 'Error while bridging';
    return 'Deposit';
  };

  const onSubmit = async (data: DepositFormData) => {
    try {
      await deposit(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
    } catch (_error) {
      // handled by hook
    }
  };

  useEffect(() => {
    if (depositStatus === DepositStatus.SUCCESS) {
      reset(); // Reset form after successful transaction
      setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      if (!hash) return;

      const explorerUrl = isEthereum
        ? explorerUrls[layerzero.id]?.layerzeroscan
        : explorerUrls[lifi.id]?.lifiscan;

      Toast.show({
        type: 'success',
        text1: isEthereum ? 'Depositing USDC' : 'Bridged USDC',
        text2: isEthereum ? 'Staking USDC to the protocol' : 'Deposit will start soon',
        props: {
          link: `${explorerUrl}/tx/${hash}`,
          linkText: eclipseAddress(hash),
          image: require('@/assets/images/usdc.png'),
        },
      });
    }
  }, [reset, setModal, depositStatus, isEthereum, hash]);

  const isFormDisabled = () => {
    return isLoading || !isValid || !watchedAmount;
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-muted-foreground">From wallet</Text>
          <ConnectedWalletDropdown />
        </View>
        <View className="gap-2">
          <Text className="text-muted-foreground">Deposit amount</Text>
          <View className="pl-5 pr-8 py-4 bg-accent rounded-2xl flex-row items-center justify-between gap-2 w-full">
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="decimal-pad"
                  className="flex-1 text-2xl text-white font-semibold web:focus:outline-none"
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
              <Image
                source={require('@/assets/images/usdc.png')}
                alt="USDC"
                style={{ width: 32, height: 32 }}
              />
              <Text className="font-semibold text-white text-lg">
                {BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.name}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Wallet color="gray" size={16} />
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedBalance))} USDC
            </Text>
            <Max
              onPress={() => {
                setValue('amount', formattedBalance);
                trigger('amount');
              }}
            />
          </View>
        </View>
        <TokenDetails>
          <View className="p-4 md:p-5 md:flex-row md:items-center gap-2 md:gap-10">
            <View className="flex-row items-center gap-2 md:w-40">
              <Text className="text-lg opacity-40">You will receive</Text>
              {!isSponsor && !isEthereum && (
                <TooltipPopover
                  content={
                    <Text className="max-w-52">
                      Bridge gas fee may significantly reduce received amount
                    </Text>
                  }
                />
              )}
            </View>
            <View className="flex-row items-center gap-2">
              <Image
                source={require('@/assets/images/sousd-4x.png')}
                style={{ width: 34, height: 34 }}
                contentFit="contain"
              />
              <View className="flex-row items-baseline gap-2">
                <Text className="text-2xl font-semibold">
                  {isPreviewDepositLoading ? (
                    <Skeleton className="w-20 h-8" />
                  ) : (
                    parseFloat(amountOut.toFixed(3)) || 0
                  )}
                </Text>
                <Text>soUSD</Text>
              </View>
              {/* <Text className="text-lg opacity-40 text-right">
                      {`(${compactNumberFormat(costInUsd)} USDC in fee)`}
                    </Text> */}
            </View>
          </View>
          <View className="p-4 md:p-5 md:flex-row md:items-center gap-2 md:gap-10">
            <Text className="text-lg opacity-40 md:w-40">Exchange rate</Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-2xl font-semibold">
                {exchangeRate ? formatUnits(exchangeRate, 6) : <Skeleton className="w-20 h-8" />}
              </Text>
            </View>
          </View>
          <View className="p-4 md:p-5 md:flex-row md:items-center gap-2 md:gap-10">
            <Text className="text-lg opacity-40 md:w-40">APY</Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-2xl font-semibold text-[#94F27F]">
                {totalAPY ? `${totalAPY.toFixed(2)}%` : <Skeleton className="w-20 h-8" />}
              </Text>
              {/* <Text className="text-base opacity-40">
                  {totalAPY ? (
                    `Earn ~${compactNumberFormat(
                      Number(watchedAmount) * (totalAPY / 100)
                    )} USDC/year`
                  ) : (
                    <Skeleton className="w-20 h-6" />
                  )}
                </Text> */}
            </View>
          </View>
        </TokenDetails>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Fuel color="gray" size={18} />
            <Text className="text-base text-muted-foreground max-w-xs">
              Gasless deposit
              {isSponsor ? '' : ` - Please deposit above $${EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT} so we can cover your fees`}
            </Text>
          </View>
        </View>
        <CheckConnectionWrapper props={{ size: 'xl' }}>
          <Button
            variant="brand"
            className="rounded-2xl h-12"
            onPress={handleSubmit(onSubmit)}
            disabled={isFormDisabled()}
          >
            <Text className="text-lg font-semibold">{getButtonText()?.slice(0, 30)}</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>
        </CheckConnectionWrapper>
      </View>
    </Pressable>
  );
}

export default DepositToVaultForm;
