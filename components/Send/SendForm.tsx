import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Wallet } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { formatUnits, zeroAddress } from 'viem';
import { useBalance } from 'wagmi';
import { z } from 'zod';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';
import ToInput from './ToInput';
import Max from '@/components/Max';
import NeedHelp from '@/components/NeedHelp';

interface SendFormProps {
  onNext: () => void;
}

const SendForm: React.FC<SendFormProps> = ({ onNext }) => {
  const { selectedToken, amount, setAmount, setModal } = useSendStore();
  const { user } = useUser();

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
    if (!selectedToken) return 0;
    if (balance) {
      return Number(formatUnits(balance, selectedToken.contractDecimals));
    }
    return Number(
      formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals),
    );
  }, [selectedToken, balance]);

  const sendSchema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} ${selectedToken?.contractTickerSymbol || ''}`,
        )
        .transform(val => Number(val)),
    });
  }, [selectedToken, balanceAmount]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm({
    resolver: zodResolver(sendSchema),
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: {
      amount,
    },
  });

  const balanceUSD = useMemo(() => {
    if (!selectedToken) return 0;
    return Number(amount) * (selectedToken?.quoteRate || 0);
  }, [selectedToken, amount]);

  useEffect(() => {
    if (amount) setValue('amount', amount);
  }, [amount, setValue]);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setValue('amount', value);
  };

  const handleTokenSelectorPress = () => {
    track(TRACKING_EVENTS.SEND_PAGE_TOKEN_SELECTOR_OPENED, {
      source: 'send_modal',
      current_token: selectedToken?.contractTickerSymbol || null,
    });
    setModal(SEND_MODAL.OPEN_TOKEN_SELECTOR);
  };

  const handleMaxPress = () => {
    if (selectedToken && balanceAmount > 0) {
      const maxAmount = balanceAmount.toString();
      setAmount(maxAmount);
      setValue('amount', maxAmount);
    }
  };

  const onSubmit = (data: any) => {
    setAmount(data.amount.toString());
    onNext();
  };

  return (
    <View className="gap-8">
      <View className="gap-8 min-h-[30rem]">
        <ToInput />

        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base opacity-70 font-medium">Amount</Text>
            {selectedToken && (
              <View className="flex-row items-center gap-2">
                <Wallet size={16} color="#ffffff80" />
                <Text className="text-base opacity-50">
                  {isLoading
                    ? '...'
                    : `${formatNumber(balanceAmount)} ${selectedToken.contractTickerSymbol}`}
                </Text>
                {balanceAmount > 0 && <Max onPress={handleMaxPress} />}
              </View>
            )}
          </View>
          <View className="flex-row items-center justify-between gap-2 bg-card rounded-2xl p-4">
            <View className="flex-1">
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={cn(
                      'flex-1 web:focus:outline-none text-white text-3xl font-semibold',
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
              className="flex-row items-center gap-1.5 bg-foreground/10 web:hover:bg-foreground/20 rounded-full px-3 h-12"
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
                  <View className="w-6 h-6 bg-primary/20 rounded-full" />
                  <Text className="text-muted-foreground text-lg font-semibold">Select token</Text>
                  <ChevronDown size={20} color="white" />
                </>
              )}
            </Pressable>
          </View>
          {errors.amount && (
            <Text className="text-red-400 text-sm">{errors.amount.message as string}</Text>
          )}
        </View>
      </View>

      <Button
        variant="brand"
        className="rounded-xl h-12"
        size="lg"
        onPress={handleSubmit(onSubmit)}
        disabled={!selectedToken || !isValid}
      >
        <Text className="text-base font-bold">Review</Text>
      </Button>

      <NeedHelp />
    </View>
  );
};

export default SendForm;
