import React, { useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useBalance } from 'wagmi';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { formatNumber } from '@/lib/utils';
import { Currency, Percent } from '@cryptoalgebra/fuse-sdk';
import { formatUnits } from 'viem';
import SwapTokenSelectorModal from '../TokenSelector/SwapTokenSelectorModal';

interface TokenCardProps {
  handleTokenSelection: (token: Currency) => void;
  handleValueChange?: (value: string) => void;
  handleMaxValue?: () => void;
  value: string;
  currency: Currency | null | undefined;
  otherCurrency: Currency | null | undefined;
  fiatValue?: number;
  priceImpact?: Percent;
  showMaxButton?: boolean;
  showBalance?: boolean;
  showNativeToken?: boolean;
  disabled?: boolean;
  title?: string;
  isLoading?: boolean;
}

const TokenCard: React.FC<TokenCardProps> = ({
  handleTokenSelection,
  handleValueChange,
  handleMaxValue,
  value,
  currency,
  otherCurrency,
  fiatValue,
  showMaxButton,
  showBalance = true,
  showNativeToken = true,
  disabled,
  title,
  isLoading = false,
}) => {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const account = user?.safeAddress;

  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: account,
    token: currency?.isNative ? undefined : (currency?.wrapped.address as `0x${string}`),
    query: {
      enabled: true,
    },
  });

  const balanceString = useMemo(() => {
    if (isBalanceLoading) return '...';
    if (!balance) return '0.00';
    return formatNumber(Number(formatUnits(balance.value, currency?.decimals || 18)));
  }, [balance, isBalanceLoading, currency?.decimals]);

  const handleInput = useCallback(
    (inputValue: string) => {
      if (inputValue === '.') inputValue = '0.';
      // Remove non-numeric characters except decimal point
      const cleanValue = inputValue.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = cleanValue.split('.');
      if (parts.length > 2) {
        const formattedValue = parts[0] + '.' + parts.slice(1).join('');
        handleValueChange?.(formattedValue);
      } else {
        handleValueChange?.(cleanValue);
      }
    },
    [handleValueChange],
  );

  return (
    <View className="flex flex-col w-full gap-2 transition-all duration-300 ease-out">
      {title && (
        <View className="flex-row items-center justify-between gap-2 px-1 mb-1">
          <Text className="text-sm text-muted-foreground font-medium tracking-wide">{title}</Text>
          <View className="flex-row items-center">
            {currency && account && showBalance && (
              <Text className="text-sm text-muted-foreground">
                Balance: {isBalanceLoading ? '...' : balanceString}
              </Text>
            )}
            {currency &&
              account &&
              showMaxButton &&
              !isBalanceLoading &&
              Number(balanceString) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleMaxValue}
                  className="ml-2 h-6 px-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Text className="text-xs font-medium">Max</Text>
                </Button>
              )}
          </View>
        </View>
      )}
      <View className="flex-row items-center justify-between w-full transition-all duration-300">
        <View className="flex-1 mr-4">
          {disabled ? (
            <Text className="text-3xl font-semibold text-foreground">
              {isLoading ? '...' : value || '0.0'}
            </Text>
          ) : (
            <TextInput
              value={value}
              onChangeText={handleInput}
              placeholder="0.0"
              keyboardType="numeric"
              className="text-3xl font-semibold text-foreground web:focus:outline-none"
              style={{
                fontSize: 30,
                fontWeight: '600',
                padding: 0,
              }}
              editable={!disabled}
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
            />
          )}
          {fiatValue && fiatValue > 0 ? (
            <Text className="text-sm text-muted-foreground mt-1">${fiatValue.toFixed(2)}</Text>
          ) : value && Number(value) > 0 ? (
            <Text className="text-sm text-muted-foreground mt-1 opacity-60">~$0.00</Text>
          ) : null}
        </View>

        <SwapTokenSelectorModal
          open={open}
          setOpen={setOpen}
          onSelect={handleTokenSelection}
          currentCurrency={currency}
          otherCurrency={otherCurrency}
          showNativeToken={showNativeToken}
        />
      </View>
    </View>
  );
};

export default TokenCard;
