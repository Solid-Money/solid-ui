import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Wallet } from 'lucide-react-native';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { cn, formatNumber } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';

import ToInput from './ToInput';

interface SendFormProps {
  onNext: () => void;
}

const SendForm: React.FC<SendFormProps> = ({ onNext }) => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { selectedToken, amount, setAmount, setModal } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      amount: state.amount,
      setAmount: state.setAmount,
      setModal: state.setModal,
    })),
  );

  const { ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens, isLoading } =
    useWalletTokens();

  // Use the live token from useWalletTokens (5s polling + SSE-invalidated) so
  // the balance stays current after a previous send. The `selectedToken`
  // snapshot in the store is captured at selection time and would otherwise
  // show a stale balance — and wagmi's useBalance has a 5-minute default
  // staleTime that isn't invalidated by the safe-account send flow.
  const liveToken = useMemo(() => {
    if (!selectedToken) return null;
    const allTokens = [
      ...ethereumTokens,
      ...fuseTokens,
      ...polygonTokens,
      ...baseTokens,
      ...arbitrumTokens,
    ];
    const fresh = allTokens.find(
      t =>
        t.contractAddress === selectedToken.contractAddress && t.chainId === selectedToken.chainId,
    );
    return fresh ?? selectedToken;
  }, [selectedToken, ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens]);

  const balanceWei = useMemo(() => {
    if (!liveToken) return 0n;
    try {
      return BigInt(liveToken.balance || '0');
    } catch {
      return 0n;
    }
  }, [liveToken]);

  const balanceAmount = useMemo(() => {
    if (!liveToken) return 0;
    return Number(formatUnits(balanceWei, liveToken.contractDecimals));
  }, [liveToken, balanceWei]);

  const sendSchema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Please enter a valid amount' })
        .refine(
          val => {
            if (!liveToken) return false;
            try {
              return parseUnits(val, liveToken.contractDecimals) > 0n;
            } catch {
              return false;
            }
          },
          { error: 'Amount must be greater than 0' },
        )
        // Compare in wei so floating-point precision can't enable Send for
        // amounts that round above the on-chain balance.
        .refine(
          val => {
            if (!liveToken) return false;
            try {
              return parseUnits(val, liveToken.contractDecimals) <= balanceWei;
            } catch {
              return false;
            }
          },
          {
            error: `Available balance is ${formatNumber(balanceAmount)} ${liveToken?.contractTickerSymbol || ''}`,
          },
        ),
    });
  }, [liveToken, balanceAmount, balanceWei]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    trigger,
  } = useForm({
    resolver: zodResolver(sendSchema),
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: {
      amount,
    },
  });

  const balanceUSD = useMemo(() => {
    if (!liveToken) return 0;
    return Number(amount) * (liveToken?.quoteRate || 0);
  }, [liveToken, amount]);

  useEffect(() => {
    if (amount) setValue('amount', amount);
  }, [amount, setValue]);

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(value);
      setValue('amount', value);
    },
    [setAmount, setValue],
  );

  const handleTokenSelectorPress = useCallback(() => {
    track(TRACKING_EVENTS.SEND_PAGE_TOKEN_SELECTOR_OPENED, {
      source: 'send_modal',
      current_token: liveToken?.contractTickerSymbol || null,
    });
    setModal(SEND_MODAL.OPEN_TOKEN_SELECTOR);
  }, [setModal, liveToken]);

  const handleMaxPress = useCallback(() => {
    if (!liveToken || balanceWei === 0n) return;
    // Format from the BigInt directly so the resulting decimal string
    // round-trips through parseUnits exactly. Routing through Number()
    // (then `.toString()`) drops low-order digits and can make parseUnits
    // round above the actual balance, causing the on-chain transfer to revert.
    const maxAmount = formatUnits(balanceWei, liveToken.contractDecimals);
    setAmount(maxAmount);
    setValue('amount', maxAmount);
    // RHF's onChange mode validates on the Controller's input change event,
    // not on programmatic setValue. Without an explicit trigger, isValid
    // stays at its prior value and Review stays disabled when the user
    // hits Max without typing first.
    trigger('amount');
  }, [setAmount, setValue, trigger, liveToken, balanceWei]);

  const onSubmit = useCallback(
    (data: any) => {
      setAmount(data.amount.toString());
      onNext();
    },
    [setAmount, onNext],
  );

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="min-h-[17rem] flex-1 gap-8">
        <ToInput />

        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Amount</Text>
            {liveToken && (
              <View className="flex-row items-center gap-2">
                <Wallet size={16} color="#ffffff80" />
                <Text className="text-base opacity-50">
                  {isLoading && balanceWei === 0n
                    ? '...'
                    : `${formatNumber(balanceAmount)} ${liveToken.contractTickerSymbol}`}
                </Text>
                {balanceWei > 0n && <Max onPress={handleMaxPress} />}
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
                      handleAmountChange(text);
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
                  <Text className="text-lg font-semibold">
                    {selectedToken.contractTickerSymbol}
                  </Text>
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
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-xl"
        size="lg"
        onPress={handleSubmit(onSubmit)}
        disabled={!selectedToken || !isValid}
      >
        <Text className="text-base font-bold">Review</Text>
      </Button>
    </View>
  );
};

export default SendForm;
