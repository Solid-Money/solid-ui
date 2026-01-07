import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { ChevronDown, Fuel, Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address, formatUnits } from 'viem';
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
import { explorerUrls, layerzero } from '@/constants/explorers';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import useDepositFromEOA from '@/hooks/useDepositFromEOA';
import { useDimension } from '@/hooks/useDimension';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { Status } from '@/lib/types';
import { compactNumberFormat, eclipseAddress, formatNumber } from '@/lib/utils';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';

function DepositToVaultForm() {
  const { setModal, setTransaction, srcChainId, outputToken } = useDepositStore();
  const { isScreenMedium } = useDimension();

  const selectedTokenInfo = useMemo(() => {
    const tokens = BRIDGE_TOKENS[srcChainId]?.tokens;
    const tokenData = tokens ? tokens[outputToken as keyof typeof tokens] : undefined;

    return {
      address: tokenData?.address,
      name: tokenData?.name || outputToken,
      image: tokenData?.icon || getAsset('images/usdc.png'),
      fullName: tokenData?.fullName,
      version: tokenData?.version,
    };
  }, [srcChainId, outputToken]);

  const { balance, deposit, depositStatus, hash, isEthereum, error } = useDepositFromEOA(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    selectedTokenInfo?.version,
  );

  const isLoading = depositStatus.status === Status.PENDING;
  const { maxAPY } = useMaxAPY();

  const formattedBalance = balance ? formatUnits(balance, 6) : '0';

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, 6)) : 0;

    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Please enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT), {
          error: `Minimum ${EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT} USDC`,
        })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} USDC`,
        })
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
    routingFee,
  } = usePreviewDeposit(watchedAmount || '0', selectedTokenInfo?.address, srcChainId);

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (depositStatus.status === Status.PENDING) return depositStatus.message;
    if (depositStatus.status === Status.SUCCESS) return 'Successfully deposited!';
    if (depositStatus.status === Status.ERROR) return error || 'Error while depositing';
    return 'Deposit';
  };

  const handleSuccess = () => {
    // Note: DEPOSIT_COMPLETED tracking is handled by useDepositFromEOA hook
    // which has complete deposit details (amount, transaction hash, user info, etc.)

    reset(); // Reset form after successful transaction
    setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
    if (!hash) return;

    const explorerUrl = explorerUrls[layerzero.id]?.layerzeroscan;

    Toast.show({
      type: 'success',
      text1: 'Depositing USDC',
      text2: 'Staking USDC to the protocol',
      props: {
        link: `${explorerUrl}/tx/${hash}`,
        linkText: eclipseAddress(hash),
        image: getAsset('images/usdc.png'),
      },
    });
  };

  const onSubmit = async (data: DepositFormData) => {
    // Capture attribution for conversion funnel tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    try {
      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: isEthereum,
        is_sponsor: isSponsor,
        // expected_output: amountOut.toString(),
        exchange_rate: exchangeRate,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      const trackingId = await deposit(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
        trackingId,
      });
      handleSuccess();
    } catch (error) {
      track(TRACKING_EVENTS.DEPOSIT_FAILED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: isEthereum,
        error: String(error),
        ...attributionData,
        attribution_channel: attributionChannel,
      });
      // handled by hook
    }
  };

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
                  source={selectedTokenInfo.image}
                  alt={selectedTokenInfo.name}
                  style={{ width: 32, height: 32 }}
                />
                <Text className="text-lg font-semibold text-white">{selectedTokenInfo.name}</Text>
                {selectedTokenInfo.fullName && <TooltipPopover text={selectedTokenInfo.fullName} />}
                <ChevronDown size={16} color="#A1A1A1" />
              </Pressable>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Wallet color="#A1A1A1" size={16} />
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedBalance))} {selectedTokenInfo.name}
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
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg text-muted-foreground">You will receive</Text>
            </View>
            <View className="ml-auto flex-shrink-0 flex-row items-center gap-2">
              <Image
                source={getAsset('images/sousd-4x.png')}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
              <View className="flex-row items-baseline gap-1">
                <Text className="text-lg font-semibold">
                  {isPreviewDepositLoading ? (
                    <Skeleton className="h-7 w-20 bg-white/20" />
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
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Price</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-lg font-semibold">
                {'1 soUSD = '}
                {`$${formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 0)}`}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Routing Fee</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              {isPreviewDepositLoading ? (
                <Skeleton className="h-7 w-20 bg-white/20" />
              ) : (
                <Text className="text-lg font-semibold">{`$${formatNumber(routingFee)}`}</Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">APY</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-lg font-semibold text-[#94F27F]">
                {maxAPY ? `${maxAPY.toFixed(2)}%` : <Skeleton className="h-7 w-20 bg-white/20" />}
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
          <View className="align-items: start flex-row items-center gap-2">
            <Fuel color="#A1A1A1" size={16} className="mt-1" />
            <Text className="max-w-xs text-base text-muted-foreground">
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
            className="h-12 rounded-2xl"
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
