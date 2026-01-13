import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { UNSTAKE_MODAL } from '@/constants/modals';
import useBridgeToMainnet from '@/hooks/useBridgeToMainnet';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import useWithdraw from '@/hooks/useWithdraw';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { Image } from 'expo-image';
import { ChevronDown, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { formatUnits, zeroAddress } from 'viem';
import { useBalance } from 'wagmi';
import { z } from 'zod';

const RegularWithdrawForm = () => {
  const { user } = useUser();
  const { selectedToken, setModal, setTransaction } = useUnstakeStore();

  // Use vault balance for selected token, fallback to Fuse vault balance
  const { data: formattedBalance, isLoading: isLoadingFuseBalance } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );

  const tokenType = selectedToken?.type || TokenType.ERC20;
  const isNative = tokenType === TokenType.NATIVE;

  const { data: balanceNative, isLoading: isBalanceNativeLoading } = useBalance({
    address: user?.safeAddress as `0x${string}` | undefined,
    chainId: selectedToken?.chainId,
    query: {
      enabled: !!user?.safeAddress && !!selectedToken && isNative,
    },
  });

  const { data: balanceERC20, isLoading: isBalanceERC20Loading } = useBalance({
    address: user?.safeAddress as `0x${string}` | undefined,
    token:
      selectedToken && !isNative && selectedToken.contractAddress !== zeroAddress
        ? (selectedToken.contractAddress as `0x${string}`)
        : undefined,
    chainId: selectedToken?.chainId,
    query: {
      enabled: !!user?.safeAddress && !!selectedToken && !isNative,
    },
  });

  const balance = isNative ? balanceNative?.value : balanceERC20?.value;
  const isLoading = isNative ? isBalanceNativeLoading : isBalanceERC20Loading;

  const balanceAmount = useMemo(() => {
    if (!selectedToken) {
      return formattedBalance ? Number(formattedBalance) : 0;
    }
    if (balance) {
      return Number(formatUnits(balance, selectedToken.contractDecimals));
    }
    return Number(
      formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals),
    );
  }, [selectedToken, balance, formattedBalance]);

  const bridgeSchema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Please enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${selectedToken?.contractTickerSymbol || 'soUSD'}`,
        })
        .transform(val => Number(val)),
    });
  }, [selectedToken, balanceAmount]);

  type WithdrawFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid: isBridgeValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(bridgeSchema) as any,
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: {
      amount: '',
    },
  });

  const watchedAmount = watch('amount');
  const { bridge, bridgeStatus } = useBridgeToMainnet();
  const { withdraw, withdrawStatus } = useWithdraw();
  const isBridgeLoading = bridgeStatus === Status.PENDING;
  const isWithdrawLoading = withdrawStatus === Status.PENDING;
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Determine if soUSD is on Fuse (chainId 122) or Ethereum (chainId 1)
  const isSoUSDOnFuse = selectedToken?.chainId === 122;
  const isSoUSDOnEthereum = selectedToken?.chainId === 1;

  const balanceUSD = useMemo(() => {
    if (!selectedToken) return 0;
    return Number(watchedAmount || 0) * (selectedToken?.quoteRate || 0);
  }, [selectedToken, watchedAmount]);

  const handleTokenSelectorPress = () => {
    setModal(UNSTAKE_MODAL.OPEN_TOKEN_SELECTOR);
  };

  const handleMaxPress = () => {
    if (balanceAmount > 0) {
      const maxAmount = balanceAmount.toString();
      setValue('amount', maxAmount);
      trigger('amount');
    }
  };

  const onBridgeSubmit = async (data: WithdrawFormData) => {
    try {
      await bridge(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
      });
      setActiveStep(2);
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Error while withdrawing',
      });
    }
  };

  const onSwapSubmit = async (data: WithdrawFormData) => {
    try {
      const transaction = await withdraw(data.amount.toString());
      setTransaction({
        amount: Number(watchedAmount),
      });
      reset(); // Reset form after successful transaction
      setModal(UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Swap transaction submitted',
        text2: `${data.amount} ${selectedToken?.contractTickerSymbol || 'soUSD'}`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({
            tokenSymbol: 'soUSD',
          }),
        },
      });
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Error while swapping',
      });
    }
  };

  const isWithdrawFormDisabled = () => {
    return (
      isLoadingFuseBalance || !isBridgeValid || !watchedAmount || isBridgeLoading || !selectedToken
    );
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Amount</Text>
            {selectedToken && (
              <View className="flex-row items-center gap-2">
                <Wallet size={16} color="#ffffff80" />
                <Text className="text-base opacity-50">
                  {isLoading || isLoadingFuseBalance
                    ? '...'
                    : `${formatNumber(balanceAmount)} ${selectedToken.contractTickerSymbol}`}
                </Text>
                {balanceAmount > 0 && <Max onPress={handleMaxPress} />}
              </View>
            )}
          </View>
          <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-card p-4">
            <View className="flex-1">
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'flex-1 text-3xl font-semibold text-white web:focus:outline-none',
                    )}
                    placeholder="0.0"
                    placeholderTextColor="#ffffff80"
                    value={value}
                    onChangeText={text => {
                      onChange(text);
                    }}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    style={{ minWidth: 80 }}
                    returnKeyType="done"
                  />
                )}
              />

              <Text className="text-sm opacity-50">${formatNumber(balanceUSD, 2)}</Text>
            </View>

            <Pressable
              className="h-12 flex-row items-center gap-1.5 rounded-full bg-foreground/10 px-3 web:hover:bg-foreground/20"
              onPress={handleTokenSelectorPress}
            >
              {selectedToken ? (
                <>
                  <RenderTokenIcon
                    tokenIcon={getTokenIcon({
                      logoUrl: selectedToken.logoUrl,
                      tokenSymbol: selectedToken.contractTickerSymbol,
                      size: 28,
                    })}
                    size={28}
                  />
                  <View className="flex-col">
                    <Text className="text-lg/5 font-semibold">
                      {selectedToken.contractTickerSymbol}
                    </Text>
                    <Text className="text-sm/4 font-medium opacity-50">
                      {getBridgeChain(selectedToken.chainId).name}
                    </Text>
                  </View>
                  <ChevronDown size={20} color="white" />
                </>
              ) : (
                <>
                  <View className="h-6 w-6 rounded-full bg-primary/20" />
                  <Text className="text-lg font-semibold text-muted-foreground">Select token</Text>
                  <ChevronDown size={20} color="white" />
                </>
              )}
            </Pressable>
          </View>
          {errors.amount && (
            <Text className="text-sm text-red-400">{errors.amount.message as string}</Text>
          )}
        </View>
        {/* To */}
        <View className="mb-4 mt-4 gap-2">
          <Text className="text-base font-medium opacity-70">To</Text>
          <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-card p-4">
            <View className="flex-row items-center gap-1.5">
              <RenderTokenIcon
                tokenIcon={getTokenIcon({
                  tokenSymbol: 'USDC',
                  size: 28,
                })}
                size={28}
              />
              <View className="flex-col">
                <Text className="text-base">USDC on Ethereum</Text>
              </View>
            </View>
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
            <Text className="text-base text-muted-foreground">Fee</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-base font-semibold">0 USDC</Text>
            </View>
          </View>
        </TokenDetails>
        <Text className="text-base font-medium opacity-70">Actions</Text>
        <TokenDetails>
          {isSoUSDOnFuse ? (
            <>
              {/* Step 1: Bridge to Ethereum */}
              <View className="px-5 py-6 md:p-5">
                <View className="mb-4 flex-row items-center gap-2">
                  <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-muted-foreground/20">
                    <Text className="text-base font-medium text-muted-foreground">1</Text>
                  </View>
                  <View className="flex-1 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <RenderTokenIcon
                        tokenIcon={getTokenIcon({
                          tokenSymbol: 'soUSD',
                          size: 22,
                        })}
                        size={22}
                      />
                      <Text className="text-base font-bold text-white">Bridge to Ethereum</Text>
                    </View>
                    <Text className="text-base font-medium text-muted-foreground">~2 min</Text>
                  </View>
                </View>
                <Button
                  variant="brand"
                  className={cn(
                    'h-[48px] rounded-[12px]',
                    activeStep !== 1 && 'bg-white/10',
                    activeStep !== 1
                      ? 'web:disabled:hover:bg-white/10'
                      : 'web:disabled:hover:bg-brand',
                  )}
                  onPress={handleSubmit(onBridgeSubmit)}
                  disabled={isWithdrawFormDisabled() || activeStep !== 1 || isBridgeLoading}
                >
                  {isBridgeLoading ? (
                    <ActivityIndicator color="gray" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <Image
                        source={
                          activeStep !== 1
                            ? require('@/assets/images/key-muted.png')
                            : require('@/assets/images/key.png')
                        }
                        className="h-6 w-6"
                        contentFit="contain"
                      />
                      <Text
                        className={cn(
                          'text-base font-bold',
                          activeStep !== 1 ? 'text-white/50' : 'text-primary-foreground',
                        )}
                      >
                        Bridge
                      </Text>
                    </View>
                  )}
                </Button>
              </View>
              {/* Divider */}
              <View className="border-b border-border/40" />
              {/* Step 2: Swap to USDC */}
              <View className="px-5 py-6 md:p-5">
                <View className="mb-4 flex-row items-center gap-2">
                  <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-muted-foreground/20">
                    <Text className="text-base font-medium text-muted-foreground">2</Text>
                  </View>
                  <View className="flex-1 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <RenderTokenIcon
                        tokenIcon={getTokenIcon({
                          tokenSymbol: 'USDC',
                          size: 22,
                        })}
                        size={22}
                      />
                      <Text className="text-base font-bold text-white">Withdraw to USDC</Text>
                    </View>
                    <Text className="text-base font-medium text-muted-foreground">Up to 24H</Text>
                  </View>
                </View>
                <Button
                  variant="brand"
                  className={cn(
                    'h-[48px] rounded-[12px]',
                    activeStep !== 2 && 'bg-white/10',
                    activeStep !== 2
                      ? 'web:disabled:hover:bg-white/10'
                      : 'web:disabled:hover:bg-brand',
                  )}
                  onPress={handleSubmit(onSwapSubmit)}
                  disabled={activeStep !== 2 || isWithdrawFormDisabled() || isWithdrawLoading}
                >
                  {isWithdrawLoading ? (
                    <ActivityIndicator color="gray" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <Image
                        source={
                          activeStep !== 2
                            ? require('@/assets/images/key-muted.png')
                            : require('@/assets/images/key.png')
                        }
                        className="h-6 w-6"
                        contentFit="contain"
                      />
                      <Text
                        className={cn(
                          'text-base font-bold',
                          activeStep !== 2 ? 'text-white/50' : 'text-primary-foreground',
                        )}
                      >
                        Withdraw
                      </Text>
                    </View>
                  )}
                </Button>
              </View>
            </>
          ) : isSoUSDOnEthereum ? (
            /* Step 1: Swap to USDC (Ethereum) */
            <View className="px-5 py-6 md:p-5">
              <View className="mb-4 flex-row items-center gap-3">
                <View className="flex-1 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <RenderTokenIcon
                      tokenIcon={getTokenIcon({
                        tokenSymbol: 'USDC',
                        size: 22,
                      })}
                      size={22}
                    />
                    <Text className="text-base font-bold text-white">Withdraw to USDC</Text>
                  </View>
                  <Text className="text-base font-medium text-muted-foreground">Up to 24H</Text>
                </View>
              </View>
              <Button
                variant="brand"
                className="h-[48px] rounded-[12px] web:disabled:hover:bg-brand"
                onPress={handleSubmit(onSwapSubmit)}
                disabled={isWithdrawFormDisabled() || isWithdrawLoading}
              >
                {isWithdrawLoading ? (
                  <ActivityIndicator color="gray" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Image
                      source={require('@/assets/images/key.png')}
                      className="h-6 w-6"
                      contentFit="contain"
                    />
                    <Text className="text-base font-bold text-primary-foreground">Withdraw</Text>
                  </View>
                )}
              </Button>
            </View>
          ) : null}
        </TokenDetails>
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
