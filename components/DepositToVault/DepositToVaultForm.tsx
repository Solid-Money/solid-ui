import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Fuel, Wallet } from 'lucide-react-native';
import { Address, formatUnits } from 'viem';
import { fuse } from 'viem/chains';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import { CheckConnectionWrapper } from '@/components/CheckConnectionWrapper';
import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { explorerUrls, layerzero } from '@/constants/explorers';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { isStablecoinSymbol } from '@/constants/stablecoins';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import useDepositFromEOA from '@/hooks/useDepositFromEOA';
import useDepositFromEOAFuse from '@/hooks/useDepositFromEOAFuse';
import useDepositFromSolidFuse from '@/hooks/useDepositFromSolidFuse';
import { useDimension } from '@/hooks/useDimension';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { Status } from '@/lib/types';
import { compactNumberFormat, eclipseAddress, formatNumber } from '@/lib/utils';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';

function getGaslessText(
  minAmount: string,
  tokenSymbol: string | undefined,
  isSponsor: boolean,
): string {
  if (isSponsor) return 'Gasless deposit';
  const amountLabel = isStablecoinSymbol(tokenSymbol)
    ? `$${minAmount}`
    : `${minAmount} ${tokenSymbol ?? 'token'}`;
  return `Gasless deposit - Please deposit above ${amountLabel} so we can cover your fees`;
}

function DepositToVaultForm() {
  const { setModal, setTransaction, srcChainId, outputToken, depositFromSolid } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setTransaction: state.setTransaction,
      srcChainId: state.srcChainId,
      outputToken: state.outputToken,
      depositFromSolid: state.depositFromSolid,
    })),
  );
  const { isScreenMedium } = useDimension();
  const { vault } = useVaultDepositConfig();
  const { data: vaultExchangeRate } = useVaultExchangeRate(vault.name);

  const vaultToken = vault.vaultToken ?? 'soUSD';
  const vaultTokenIcon =
    vault.name === 'USDC' ? getAsset('images/sousd-4x.png') : getAsset(vault.icon);

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

  const {
    balance: balanceFuse,
    deposit: depositFuse,
    depositStatus: depositStatusFuse,
    hash: hashFuse,
    error: errorFuse,
  } = useDepositFromEOAFuse(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
  );

  const {
    balance: balanceSolidFuse,
    deposit: depositSolidFuse,
    depositStatus: depositStatusSolidFuse,
    hash: hashSolidFuse,
    error: errorSolidFuse,
  } = useDepositFromSolidFuse(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
  );

  const isFuseVault = vault.name === 'FUSE';
  const useSolidForFuse = isFuseVault && depositFromSolid;
  const balanceForVault = isFuseVault
    ? useSolidForFuse
      ? balanceSolidFuse
      : balanceFuse
    : balance;
  const balanceDecimals = isFuseVault ? 18 : 6;
  const depositFn = isFuseVault ? (useSolidForFuse ? depositSolidFuse : depositFuse) : deposit;
  const depositStatusForVault = isFuseVault
    ? useSolidForFuse
      ? depositStatusSolidFuse
      : depositStatusFuse
    : depositStatus;
  const hashForVault = isFuseVault ? (useSolidForFuse ? hashSolidFuse : hashFuse) : hash;
  const errorForVault = isFuseVault ? (useSolidForFuse ? errorSolidFuse : errorFuse) : error;

  const isLoading = depositStatusForVault.status === Status.PENDING;
  const { maxAPY } = useMaxAPY();

  const formattedBalance = balanceForVault ? formatUnits(balanceForVault, balanceDecimals) : '0';

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balanceForVault
      ? Number(formatUnits(balanceForVault, balanceDecimals))
      : 0;
    const tokenLabel = isFuseVault ? (selectedTokenInfo?.name ?? 'WFUSE') : 'USDC';

    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Please enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT), {
          error: `Minimum ${EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT} ${tokenLabel}`,
        })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${tokenLabel}`,
        })
        .transform(val => Number(val)),
    });
  }, [balanceForVault, balanceDecimals, isFuseVault, selectedTokenInfo?.name]);

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

  // Track form viewed (once per mount)
  const hasTrackedFormView = useRef(false);

  useEffect(() => {
    if (!hasTrackedFormView.current) {
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_VIEWED, {
        deposit_method: 'wallet',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
      hasTrackedFormView.current = true;
    }
  }, [srcChainId, selectedTokenInfo.name, formattedBalance]);

  // Track amount entry start (once per form session)
  const hasTrackedAmountEntry = useRef(false);

  useEffect(() => {
    if (watchedAmount && !hasTrackedAmountEntry.current) {
      hasTrackedAmountEntry.current = true;
      track(TRACKING_EVENTS.DEPOSIT_AMOUNT_ENTRY_STARTED, {
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
    }
  }, [watchedAmount, srcChainId, selectedTokenInfo.name, formattedBalance]);

  // Track validation errors
  useEffect(() => {
    if (errors.amount) {
      track(TRACKING_EVENTS.DEPOSIT_VALIDATION_ERROR, {
        error_message: errors.amount.message,
        attempted_amount: watchedAmount,
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
    }
  }, [errors.amount, watchedAmount, srcChainId, selectedTokenInfo.name, formattedBalance]);

  const {
    amountOut: previewAmountOut,
    isLoading: isPreviewDepositLoading,
    routingFee,
  } = usePreviewDeposit(watchedAmount || '0', selectedTokenInfo?.address, srcChainId);

  // Use vault's accountant rate for display; amountOut from preview (USDC + LiFi) or vault rate (e.g. FUSE)
  const amountOut =
    vault.name === 'USDC'
      ? previewAmountOut
      : Number(watchedAmount || 0) / (vaultExchangeRate ?? 1);
  const isAmountOutLoading =
    vault.name === 'USDC' ? isPreviewDepositLoading : vaultExchangeRate === undefined;
  const displayRate = vault.name === 'USDC' ? vaultExchangeRate : vaultExchangeRate;

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (depositStatusForVault.status === Status.PENDING) return depositStatusForVault.message;
    if (depositStatusForVault.status === Status.SUCCESS) return 'Successfully deposited!';
    if (depositStatusForVault.status === Status.ERROR)
      return errorForVault || 'Error while depositing';
    return 'Deposit';
  };

  const handleSuccess = () => {
    // Note: DEPOSIT_COMPLETED tracking is handled by useDepositFromEOA / useDepositFromEOAFuse
    // which have complete deposit details (amount, transaction hash, user info, etc.)

    reset(); // Reset form after successful transaction
    setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
    if (!hashForVault) return;

    const explorerUrl = isFuseVault
      ? explorerUrls[fuse.id]?.blockscout
      : explorerUrls[layerzero.id]?.layerzeroscan;

    Toast.show({
      type: 'success',
      text1: isFuseVault ? 'Depositing FUSE' : 'Depositing USDC',
      text2: isFuseVault ? 'Staking FUSE to the protocol' : 'Staking USDC to the protocol',
      props: {
        link: `${explorerUrl}/tx/${hashForVault}`,
        linkText: eclipseAddress(hashForVault),
        image: getAsset(isFuseVault ? 'images/fuse-4x.png' : 'images/usdc.png'),
      },
    });
  };

  const onSubmit = async (data: DepositFormData) => {
    // Capture attribution for conversion funnel tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    try {
      // Track wallet form submission specifically
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_SUBMITTED, {
        deposit_method: 'wallet',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        amount: data.amount,
        balance: formattedBalance,
        is_sponsor: isSponsor,
      });

      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: !isFuseVault && isEthereum,
        is_sponsor: isSponsor,
        exchange_rate: vaultExchangeRate,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      const trackingId = await depositFn(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
        trackingId,
      });
      handleSuccess();
    } catch (error) {
      track(TRACKING_EVENTS.DEPOSIT_FAILED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: !isFuseVault && isEthereum,
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
          <Text className="text-muted-foreground">{useSolidForFuse ? '' : 'From wallet'}</Text>
          {!useSolidForFuse && <ConnectedWalletDropdown />}
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
                track(TRACKING_EVENTS.DEPOSIT_MAX_BUTTON_CLICKED, {
                  chain_id: srcChainId,
                  token: selectedTokenInfo.name,
                  max_amount: formattedBalance,
                });
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
                source={vaultTokenIcon}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
              <View className="flex-row items-baseline gap-1">
                <Text className="text-lg font-semibold">
                  {isAmountOutLoading ? (
                    <Skeleton className="h-7 w-20 bg-white/20" />
                  ) : isScreenMedium ? (
                    compactNumberFormat(amountOut || 0)
                  ) : (
                    parseFloat((amountOut || 0).toFixed(3)) || 0
                  )}
                </Text>
                <Text className="text-lg">{vaultToken}</Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Price</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-lg font-semibold">
                {`1 ${vaultToken} = `}
                {vault.name === 'USDC'
                  ? `$${formatNumber(displayRate ?? 0)}`
                  : `${formatNumber(displayRate ?? 0)} ${selectedTokenInfo.name}`}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Routing Fee</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              {vault.name === 'USDC' && isPreviewDepositLoading ? (
                <Skeleton className="h-7 w-20 bg-white/20" />
              ) : (
                <Text className="text-lg font-semibold">
                  {vault.name === 'USDC' ? `$${formatNumber(routingFee)}` : '$0'}
                </Text>
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
              {getGaslessText(
                EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
                selectedTokenInfo?.name,
                isSponsor,
              )}
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
            <Text className="text-base font-bold">{getButtonText()?.slice(0, 30)}</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>
        </CheckConnectionWrapper>
      </View>
    </Pressable>
  );
}

export default DepositToVaultForm;
