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
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { explorerUrls, layerzero, lifi } from '@/constants/explorers';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTotalAPY } from '@/hooks/useAnalytics';
import useDepositFromEOA from '@/hooks/useDepositFromEOA';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { track } from '@/lib/analytics';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { compactNumberFormat, eclipseAddress, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useDimension } from '@/hooks/useDimension';
import { Status } from '@/lib/types';

function DepositToVaultForm() {
  const { balance, deposit, depositStatus, hash, isEthereum } = useDepositFromEOA();
  const { setModal, setTransaction, srcChainId } = useDepositStore();
  const { isScreenMedium } = useDimension();

  const isLoading = depositStatus.status === Status.PENDING;
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
  const isDeposit = isEthereum || !isSponsor;

  const {
    amountOut,
    isLoading: isPreviewDepositLoading,
    exchangeRate,
  } = usePreviewDeposit(watchedAmount || '0');

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (depositStatus.status === Status.PENDING) return depositStatus.message;
    if (depositStatus.status === Status.SUCCESS)
      return isDeposit ? 'Successfully deposited!' : 'Successfully bridged!';
    if (depositStatus.status === Status.ERROR)
      return isDeposit ? 'Error while depositing' : 'Error while bridging';
    return 'Deposit';
  };

  const onSubmit = async (data: DepositFormData) => {
    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: isEthereum,
        is_sponsor: isSponsor,
        // expected_output: amountOut.toString(),
        exchange_rate: exchangeRate,
      });

      await deposit(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
    } catch (error) {
      track(TRACKING_EVENTS.DEPOSIT_FAILED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: isEthereum,
        error: String(error),
      });
      // handled by hook
    }
  };

  useEffect(() => {
    if (depositStatus.status === Status.SUCCESS) {
      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        chain_id: srcChainId,
        is_ethereum: isEthereum,
        hash: hash,
      });

      reset(); // Reset form after successful transaction
      setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      if (!hash) return;

      const explorerUrl = isDeposit
        ? explorerUrls[layerzero.id]?.layerzeroscan
        : explorerUrls[lifi.id]?.lifiscan;

      Toast.show({
        type: 'success',
        text1: isDeposit ? 'Depositing USDC' : 'Bridged USDC',
        text2: isDeposit ? 'Staking USDC to the protocol' : 'Deposit will start soon',
        props: {
          link: `${explorerUrl}/tx/${hash}`,
          linkText: eclipseAddress(hash),
          image: require('@/assets/images/usdc.png'),
        },
      });
    }
  }, [reset, setModal, depositStatus, isEthereum, hash, srcChainId, isDeposit]);

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
              <Image
                source={require('@/assets/images/usdc.png')}
                alt="USDC"
                style={{ width: 32, height: 32 }}
              />
              <Text className="font-semibold text-white text-lg">
                {BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.name}
              </Text>
              {BRIDGE_TOKENS[srcChainId]?.tokens?.USDC?.fullName && (
                <TooltipPopover text={BRIDGE_TOKENS[srcChainId].tokens.USDC.fullName} />
              )}
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Wallet color="#A1A1A1" size={16} />
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
          <View className="p-4 pr-6 md:p-5 md:flex-row md:items-center md:justify-between gap-2 md:gap-10">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg text-muted-foreground">You will receive</Text>
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
            <View className="flex-row items-center gap-2 ml-auto flex-shrink-0">
              <Image
                source={require('@/assets/images/sousd-4x.png')}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
              <View className="flex-row items-baseline gap-1">
                <Text className="text-lg font-semibold">
                  {isPreviewDepositLoading ? (
                    <Skeleton className="w-20 h-8" />
                  ) : isScreenMedium ? (
                    compactNumberFormat(amountOut || 0)
                  ) : (
                    parseFloat(amountOut.toFixed(3)) || 0
                  )}
                </Text>
                <Text className="text-lg">soUSD</Text>
              </View>
              {/* <Text className="text-lg opacity-40 text-right">
                      {`(${compactNumberFormat(costInUsd)} USDC in fee)`}
                    </Text> */}
            </View>
          </View>
          <View className="p-4 pr-6 md:p-5 md:flex-row md:items-center md:justify-between gap-2 md:gap-10">
            <Text className="text-base text-muted-foreground">Exchange rate</Text>
            <View className="flex-row items-baseline gap-2 ml-auto flex-shrink-0">
              <Text className="text-lg font-semibold">
                {exchangeRate ? formatUnits(exchangeRate, 6) : <Skeleton className="w-20 h-8" />}
              </Text>
            </View>
          </View>
          <View className="p-4 pr-6 md:p-5 md:flex-row md:items-center md:justify-between gap-2 md:gap-10">
            <Text className="text-base text-muted-foreground">APY</Text>
            <View className="flex-row items-baseline gap-2 ml-auto flex-shrink-0">
              <Text className="text-lg font-semibold text-[#94F27F]">
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
          <View className="flex-row items-center gap-2 align-items: start">
            <Fuel color="#A1A1A1" size={16} className="mt-1" />
            <Text className="text-base text-muted-foreground max-w-xs">
              Gasless deposit
              {isSponsor
                ? ''
                : ` - Please deposit above $${EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT} so we can cover your fees`}
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
