import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { CurrencyAmount } from '@cryptoalgebra/fuse-sdk';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Fuel, Leaf, Wallet as WalletIcon } from 'lucide-react-native';
import { Address, formatUnits, zeroAddress } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance } from 'wagmi';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Skeleton from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { getBridgeChain } from '@/constants/bridge';
import { CARD_REPAY_MODAL } from '@/constants/modals';
import { soUSDC_TOKEN, USDC_STARGATE_TOKEN } from '@/constants/tokens';
import { useBestTradeExactOut } from '@/hooks/swap/useBestTrade';
import { useVoltageRouter } from '@/hooks/swap/useVoltageRouter';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { useActivityActions } from '@/hooks/useActivityActions';
import useRepayAndWithdrawCollateral from '@/hooks/useRepayAndWithdrawCollateral';
import useRepayFromCollateral from '@/hooks/useRepayFromCollateral';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType, TransactionStatus, TransactionType } from '@/lib/types';
import { TradeState } from '@/lib/types/trade-state';
import { cn, formatNumber } from '@/lib/utils';
import { computeRealizedLPFeePercent, warningSeverity } from '@/lib/utils/swap/prices';
import { CardRepaySource, useCardRepayStore } from '@/store/useCardRepayStore';

import { BorrowSlider } from './BorrowSlider';

type FormData = { amount: string };

// AAVE V3 flashLoanSimple premium = 5 bps (= 0.05%). Surfaced in the UI as the
// adapter fee when repaying from collateral.
const COLLATERAL_REPAY_FEE_BPS = 0.05;
// Execution buffer added on top of the SDK-quoted input amount to absorb pool
// drift between quote and on-chain execution. Not user-facing — the *displayed*
// slippage comes straight from the trade's price impact.
const EXECUTION_BUFFER_BPS = 50n; // 0.5%

// 0=safe (≤1%), 1=low (1–3%), 2=medium (3–5%), 3=high (5–10%), 4=blocked (>10%).
function priceImpactColor(severity: 0 | 1 | 2 | 3 | 4): string {
  if (severity <= 1) return 'text-green-400';
  if (severity === 2) return 'text-yellow-400';
  return 'text-red-400';
}

function SourceSelectorContent({ onChange }: { onChange: (s: CardRepaySource) => void }) {
  return (
    <>
      <SourceOption
        icon={<WalletIcon color="#A1A1A1" size={20} />}
        label="Wallet funds"
        sublabel="Repay using USDC in wallet"
        onPress={() => onChange(CardRepaySource.WALLET)}
      />
      <SourceOption
        icon={<Leaf color="#A1A1A1" size={20} />}
        label="Collateral"
        sublabel="Repay using supplied collateral"
        onPress={() => onChange(CardRepaySource.COLLATERAL)}
      />
    </>
  );
}

function SourceOption({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onPress: () => void;
}) {
  const Wrapper: any = Platform.OS === 'web' ? DropdownMenuItem : Pressable;
  return (
    <Wrapper onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 web:cursor-pointer">
      {icon}
      <View>
        <Text className="text-base font-semibold">{label}</Text>
        <Text className="text-sm opacity-50">{sublabel}</Text>
      </View>
    </Wrapper>
  );
}

function SourceSelector({
  source,
  onChange,
}: {
  source: CardRepaySource;
  onChange: (s: CardRepaySource) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const display =
    source === CardRepaySource.WALLET
      ? { label: 'Wallet funds', icon: <WalletIcon color="#A1A1A1" size={24} /> }
      : { label: 'Collateral', icon: <Leaf color="#A1A1A1" size={24} /> };

  const trigger = (
    <Pressable
      className="flex-row items-center justify-between rounded-2xl bg-card p-4"
      onPress={() => Platform.OS !== 'web' && setIsOpen(o => !o)}
    >
      <View className="flex-row items-center gap-2">
        {display.icon}
        <Text className="text-lg font-semibold">{display.label}</Text>
      </View>
      <ChevronDown color="#A1A1A1" size={20} />
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <View className="gap-2">
        <Text className="font-medium opacity-50">Repay from</Text>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0 bg-card">
            <SourceSelectorContent onChange={onChange} />
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="font-medium opacity-50">Repay from</Text>
      {trigger}
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-card">
          <SourceSelectorContent
            onChange={s => {
              onChange(s);
              setIsOpen(false);
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function CardRepayForm() {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivityActions();
  const { setTransaction, setModal, selectedToken, source, setSource } = useCardRepayStore(
    useShallow(state => ({
      setTransaction: state.setTransaction,
      setModal: state.setModal,
      selectedToken: state.selectedToken,
      source: state.source,
      setSource: state.setSource,
    })),
  );
  const {
    totalBorrowed: borrowedAmount,
    totalSupplied,
    refetch: refetchAavePosition,
  } = useAaveBorrowPosition();
  const queryClient = useQueryClient();
  const { repayAndWithdrawCollateral } = useRepayAndWithdrawCollateral();
  const { repayFromCollateral } = useRepayFromCollateral();
  const [repayStatus, setRepayStatus] = useState<Status>(Status.IDLE);
  const [repayAllDebt, setRepayAllDebt] = useState(false);

  const isFromCollateral = source === CardRepaySource.COLLATERAL;
  const safeAddress = user?.safeAddress as Address | undefined;
  const tokenType = selectedToken?.type || TokenType.ERC20;
  const isNative = tokenType === TokenType.NATIVE;

  const { data: balanceNative, isLoading: isBalanceNativeLoading } = useBalance({
    address: safeAddress as `0x${string}` | undefined,
    chainId: selectedToken?.chainId || fuse.id,
    query: { enabled: !!safeAddress && !!selectedToken && isNative && !isFromCollateral },
  });

  const { data: balanceERC20, isLoading: isBalanceERC20Loading } = useBalance({
    address: safeAddress as `0x${string}` | undefined,
    token:
      selectedToken && !isNative && selectedToken.contractAddress !== zeroAddress
        ? (selectedToken.contractAddress as `0x${string}`)
        : !selectedToken
          ? (USDC_STARGATE as `0x${string}`)
          : undefined,
    chainId: selectedToken?.chainId || fuse.id,
    query: {
      enabled:
        !!safeAddress &&
        !isFromCollateral &&
        (!selectedToken || (!isNative && selectedToken.contractAddress !== zeroAddress)),
    },
  });

  const balance = isNative ? balanceNative?.value : balanceERC20?.value;
  const isLoading = isNative ? isBalanceNativeLoading : isBalanceERC20Loading;

  const balanceAmount = useMemo(() => {
    if (!selectedToken) {
      if (balanceERC20) return Number(formatUnits(balanceERC20.value, 6));
      return 0;
    }
    if (balance) return Number(formatUnits(balance, selectedToken.contractDecimals));
    return Number(
      formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals),
    );
  }, [selectedToken, balance, balanceERC20]);

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => isFromCollateral || Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${selectedToken?.contractTickerSymbol || 'USDC'}`,
        })
        .refine(val => Number(val) <= borrowedAmount, {
          error: `Cannot repay more than ${formatNumber(borrowedAmount)} USDC`,
        }),
    });
  }, [balanceAmount, selectedToken, borrowedAmount, isFromCollateral]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');
  const amountValue = watchedAmount ? Number(watchedAmount) : 0;

  // Reset amount when switching source so validation refires against the right ceiling.
  useEffect(() => {
    reset({ amount: '' });
    setRepayAllDebt(false);
  }, [source, reset]);

  // When "repay all" toggles on, lock the amount to the full debt so quoting
  // and submit gating still work. When it toggles off, clear so the user picks.
  useEffect(() => {
    if (!isFromCollateral) return;
    if (repayAllDebt) {
      setValue('amount', borrowedAmount.toString());
      trigger('amount');
    } else {
      reset({ amount: '' });
    }
  }, [repayAllDebt, isFromCollateral, borrowedAmount, setValue, trigger, reset]);

  const usdValue = useMemo(() => {
    if (isFromCollateral || !selectedToken) return amountValue; // 1:1 for USDC
    return amountValue * (selectedToken.quoteRate || 1);
  }, [amountValue, selectedToken, isFromCollateral]);

  const collateralFeeUsd = useMemo(
    () => (amountValue * COLLATERAL_REPAY_FEE_BPS) / 100,
    [amountValue],
  );

  // Quote the soUSD → USDC.e exact-output swap. We try Algebra (the adapter's
  // SwapRouter) first since execution can ONLY route through Algebra. We also
  // poll Voltage so the UI mirrors the swap page when Algebra has no liquidity
  // — but in that case execution is blocked because the AlgebraAdapter can't
  // call Voltage on-chain.
  const debtRepayCurrencyAmount = useMemo(() => {
    if (!isFromCollateral || amountValue <= 0) return undefined;
    try {
      const wei = BigInt(Math.floor(amountValue * 1_000_000));
      return CurrencyAmount.fromRawAmount(USDC_STARGATE_TOKEN, wei.toString());
    } catch {
      return undefined;
    }
  }, [isFromCollateral, amountValue]);

  const algebraTrade = useBestTradeExactOut(
    isFromCollateral ? soUSDC_TOKEN : undefined,
    debtRepayCurrencyAmount,
  );

  const voltageTrade = useVoltageRouter(
    isFromCollateral ? soUSDC_TOKEN : undefined,
    isFromCollateral ? USDC_STARGATE_TOKEN : undefined,
    debtRepayCurrencyAmount,
    false, // exact-output
    '0.5', // 0.5% slippage for the Voltage quote
  );

  // The price impact actually shown matches the swap page's preference: pick
  // whichever provider gives the smaller required input (cheaper for the user).
  // Falls back to whichever side has a quote when only one is available.
  const bestQuote = useMemo(() => {
    const algebraInput = algebraTrade.trade?.inputAmount;
    const voltageInput = voltageTrade.trade?.inputAmount;

    const algebraImpact = algebraTrade.trade
      ? (() => {
          try {
            return algebraTrade.trade.priceImpact.subtract(
              computeRealizedLPFeePercent(algebraTrade.trade),
            );
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const voltageImpact = voltageTrade.trade?.priceImpact;

    if (algebraInput && voltageInput) {
      const useVoltage = voltageInput.lessThan(algebraInput);
      return useVoltage
        ? { source: 'voltage' as const, impact: voltageImpact, inputAmount: voltageInput }
        : { source: 'algebra' as const, impact: algebraImpact, inputAmount: algebraInput };
    }
    if (algebraInput) {
      return { source: 'algebra' as const, impact: algebraImpact, inputAmount: algebraInput };
    }
    if (voltageInput) {
      return { source: 'voltage' as const, impact: voltageImpact, inputAmount: voltageInput };
    }
    return undefined;
  }, [algebraTrade.trade, voltageTrade.trade]);

  const priceImpactNet = bestQuote?.impact;
  const priceImpactSeverity = useMemo(() => warningSeverity(priceImpactNet), [priceImpactNet]);

  // USDC received per soUSD sold, taken from whichever quote `bestQuote` chose.
  // Showing this lets the user see the actual price they're getting after pool
  // fees + impact, distinct from the soUSD oracle rate.
  const sellPrice = useMemo(() => {
    if (!bestQuote) return undefined;
    const trade = bestQuote.source === 'algebra' ? algebraTrade.trade : voltageTrade.trade;
    if (!trade?.inputAmount || !trade?.outputAmount) return undefined;
    const input = Number(trade.inputAmount.toExact());
    const output = Number(trade.outputAmount.toExact());
    if (!input) return undefined;
    return output / input;
  }, [bestQuote, algebraTrade.trade, voltageTrade.trade]);

  // Execution path: AlgebraAdapter only swaps on Algebra, so we size the flash
  // loan from the Algebra quote even if Voltage offered a better price.
  const collateralAmountWei = useMemo(() => {
    const trade = algebraTrade.trade;
    if (!trade) return undefined;
    const quoted = BigInt(trade.inputAmount.quotient.toString());
    return (quoted * (10_000n + EXECUTION_BUFFER_BPS) + 9_999n) / 10_000n;
  }, [algebraTrade.trade]);

  const isTradeLoading =
    isFromCollateral &&
    amountValue > 0 &&
    (algebraTrade.state === TradeState.LOADING || voltageTrade.isLoading);
  const isAlgebraRouteMissing =
    isFromCollateral &&
    amountValue > 0 &&
    !isTradeLoading &&
    algebraTrade.state === TradeState.NO_ROUTE_FOUND;
  const isAnyRouteMissing = isFromCollateral && amountValue > 0 && !isTradeLoading && !bestQuote;

  const handleMaxPress = () => {
    if (balanceAmount > 0) {
      const maxAmount = Math.min(balanceAmount, borrowedAmount).toString();
      setValue('amount', maxAmount);
      trigger('amount');
    }
  };

  const handleSliderChange = useCallback(
    (val: number) => {
      setValue('amount', val.toString());
      trigger('amount');
    },
    [setValue, trigger],
  );

  const handleTokenSelectorPress = useCallback(() => {
    setModal(CARD_REPAY_MODAL.OPEN_TOKEN_SELECTOR);
  }, [setModal]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        if (!user) {
          Toast.show({
            type: 'error',
            text1: 'User not authenticated',
            text2: 'Please refresh and try again',
          });
          return;
        }

        setRepayStatus(Status.PENDING);

        if (isFromCollateral) {
          if (!collateralAmountWei) {
            throw new Error('No swap route found for repay-from-collateral');
          }
          const clientTxId = await createActivity({
            type: TransactionType.CARD_TRANSACTION,
            title: 'Card Repay (collateral)',
            shortTitle: 'Card Repay',
            amount: data.amount,
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.fuse.aaveAlgebraAdapter,
            status: TransactionStatus.PENDING,
            metadata: {
              description: `Repay ${data.amount} USDC from soUSD collateral`,
              processingStatus: 'sending',
              tokenAddress: ADDRESSES.fuse.vault,
            },
          });

          const tx = await repayFromCollateral({
            debtRepayAmount: data.amount,
            collateralAmountWei,
            repayAllDebt,
          });

          await updateActivity(clientTxId, {
            status: TransactionStatus.PENDING,
            hash: tx.transactionHash,
            url: `https://explorer.fuse.io/tx/${tx.transactionHash}`,
            metadata: {
              txHash: tx.transactionHash,
              processingStatus: 'processing',
            },
          });
        } else {
          const clientTxId = await createActivity({
            type: TransactionType.CARD_TRANSACTION,
            title: 'Card Repay',
            shortTitle: 'Card Repay',
            amount: data.amount,
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.fuse.aaveV3Pool,
            status: TransactionStatus.PENDING,
            metadata: {
              description: `Repay ${data.amount} USDC to card borrow position`,
              processingStatus: 'sending',
              tokenAddress: selectedToken?.contractAddress ?? USDC_STARGATE,
            },
          });

          const tx = await repayAndWithdrawCollateral(data.amount);

          await updateActivity(clientTxId, {
            status: TransactionStatus.PENDING,
            hash: tx.transactionHash,
            url: `https://explorer.fuse.io/tx/${tx.transactionHash}`,
            metadata: {
              txHash: tx.transactionHash,
              processingStatus: 'processing',
            },
          });
        }

        setRepayStatus(Status.SUCCESS);
        setTransaction({ amount: Number(data.amount) });
        setModal(CARD_REPAY_MODAL.OPEN_TRANSACTION_STATUS);
        reset();

        // Refresh on-chain position + wallet balance so the form shows
        // post-repay numbers next time the user opens it.
        refetchAavePosition().catch(err => {
          console.warn('Failed to refetch Aave position:', err);
        });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });

        setTimeout(() => setRepayStatus(Status.IDLE), 2000);
      } catch (error) {
        setRepayStatus(Status.ERROR);
        console.error('Repay error:', error);
        Toast.show({
          type: 'error',
          text1: 'Repay failed',
          text2: 'Please try again or check your wallet balance',
        });
      }
    },
    [
      user,
      isFromCollateral,
      collateralAmountWei,
      repayAllDebt,
      createActivity,
      updateActivity,
      repayAndWithdrawCollateral,
      repayFromCollateral,
      refetchAavePosition,
      queryClient,
      reset,
      setTransaction,
      setModal,
      selectedToken?.contractAddress,
    ],
  );

  const disabled =
    repayStatus === Status.PENDING ||
    !formState.isValid ||
    !watchedAmount ||
    borrowedAmount <= 0 ||
    isTradeLoading ||
    isAnyRouteMissing ||
    (isFromCollateral && !collateralAmountWei);

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="flex-1 gap-6">
        <SourceSelector source={source} onChange={setSource} />

        <View className="gap-4">
          {isFromCollateral ? (
            <View className="gap-4 rounded-2xl bg-card p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium opacity-70">Repay all debt</Text>
                <Switch checked={repayAllDebt} onCheckedChange={setRepayAllDebt} />
              </View>
              {!repayAllDebt && (
                <BorrowSlider
                  value={amountValue}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={borrowedAmount}
                  label="Amount to repay"
                />
              )}
            </View>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium opacity-70">Amount</Text>
                {selectedToken && (
                  <View className="flex-row items-center gap-2">
                    <WalletIcon size={16} color="#ffffff80" />
                    <Text className="text-base opacity-50">
                      {isLoading
                        ? '...'
                        : `${formatNumber(balanceAmount)} ${selectedToken.contractTickerSymbol}`}
                    </Text>
                    {balanceAmount > 0 && <Max onPress={handleMaxPress} />}
                  </View>
                )}
              </View>
              <View
                className={cn(
                  'flex-row items-center justify-between gap-2 rounded-2xl bg-card p-4',
                  formState.errors.amount && 'border border-red-500',
                )}
              >
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
                        value={value as any}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="decimal-pad"
                        style={{ minWidth: 80 }}
                        returnKeyType="done"
                      />
                    )}
                  />
                  <Text className="text-sm opacity-50">${formatNumber(usdValue, 2)}</Text>
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
                    </>
                  ) : (
                    <>
                      <Image
                        source={getAsset('images/usdc-4x.png')}
                        alt="USDC"
                        style={{ width: 28, height: 28 }}
                      />
                      <View className="flex-col">
                        <Text className="text-lg/5 font-semibold">USDC</Text>
                        <Text className="text-sm/4 font-medium opacity-50">Fuse</Text>
                      </View>
                    </>
                  )}
                  <ChevronDown size={20} color="white" />
                </Pressable>
              </View>
            </>
          )}
          {formState.errors.amount && (
            <Text className="text-sm text-red-400">{formState.errors.amount.message}</Text>
          )}
        </View>

        <View className="rounded-2xl bg-card p-4">
          <DetailRow label="Amount borrowed" value={`$${formatNumber(borrowedAmount)}`} />
          <Divider />
          <DetailRow label="Collateral supplied" value={`${formatNumber(totalSupplied)} soUSD`} />
          {isFromCollateral && (
            <>
              <Divider />
              <DetailRow
                label="Adapter fee (0.05%)"
                value={`${formatNumber(collateralFeeUsd, 4)} USDC`}
              />
              <Divider />
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium opacity-70">Price impact</Text>
                {isTradeLoading ? (
                  <Skeleton className="h-5 w-16 rounded-md" />
                ) : isAnyRouteMissing ? (
                  <Text className="text-base font-bold text-red-400">No route</Text>
                ) : priceImpactNet ? (
                  <Text
                    className={cn('text-base font-bold', priceImpactColor(priceImpactSeverity))}
                  >
                    {priceImpactNet.toFixed(2)}%
                  </Text>
                ) : (
                  <Text className="text-base font-bold opacity-50">—</Text>
                )}
              </View>
              {isAlgebraRouteMissing && bestQuote?.source === 'voltage' && (
                <>
                  <Divider />
                  <Text className="text-sm text-yellow-400">
                    Best route is on Voltage, but repay-from-collateral can only execute via
                    Algebra. Try a different amount or use wallet funds.
                  </Text>
                </>
              )}
            </>
          )}
          <Divider />
          {isFromCollateral ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-medium opacity-70">Price</Text>
              {isTradeLoading ? (
                <Skeleton className="h-5 w-24 rounded-md" />
              ) : sellPrice ? (
                <Text className="text-base font-bold text-white">
                  1 soUSD = {formatNumber(sellPrice, 4)} USDC
                </Text>
              ) : (
                <Text className="text-base font-bold opacity-50">—</Text>
              )}
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Fuel color="rgba(255, 255, 255, 0.7)" size={16} />
                <Text className="text-base font-medium opacity-70">Network fee</Text>
              </View>
              <Text className="text-base font-bold text-white">Sponsored</Text>
            </View>
          )}
        </View>
      </View>

      <View className="flex-1" />

      <Button
        variant="brand"
        className="mt-7 h-12 rounded-xl"
        disabled={disabled}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-base font-bold text-black">
          {repayStatus === Status.PENDING ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            'Repay'
          )}
        </Text>
      </Button>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-base font-medium opacity-70">{label}</Text>
      <Text className="text-base font-bold text-white">{value}</Text>
    </View>
  );
}

function Divider() {
  return <View className="my-4 h-px w-full bg-white/10" />;
}
