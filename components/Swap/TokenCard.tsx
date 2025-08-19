import { Wallet } from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useBalance } from 'wagmi';

import Max from '@/components/Max';
import SwapTokenSelectorModal from '@/components/TokenSelector/SwapTokenSelectorModal';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { formatNumber } from '@/lib/utils';
import { Currency, Percent } from '@cryptoalgebra/fuse-sdk';
import { formatUnits } from 'viem';
import { fuse } from 'viem/chains';

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
    chainId: fuse.id,
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
    <View className="bg-card flex flex-col w-full gap-2 transition-all duration-300 ease-out p-4 rounded-xl">
      {title && (
        <View className="flex-row items-center justify-between gap-2 px-1">
          <Text className="text-sm text-muted-foreground font-medium tracking-wide">{title}</Text>
        </View>
      )}
      <View className="flex-row items-center justify-between w-full transition-all duration-300">
        <View className="flex-1 mr-4">
          {disabled ? (
            <Text className="text-4xl font-semibold text-foreground">
              {isLoading ? '...' : value || '0.0'}
            </Text>
          ) : (
            <TextInput
              value={value}
              onChangeText={handleInput}
              placeholder="0.0"
              keyboardType="numeric"
              className="text-4xl font-semibold text-foreground web:focus:outline-none"
              style={{
                fontWeight: '600',
                padding: 0,
              }}
              editable={!disabled}
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
            />
          )}
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
      <View className="flex-row items-center justify-between">
        {fiatValue && fiatValue > 0 ? (
          <Text className="text-sm text-muted-foreground mt-1">${fiatValue.toFixed(2)}</Text>
        ) : value && Number(value) > 0 ? (
          <Text className="text-sm text-muted-foreground mt-1 opacity-60">~$0.00</Text>
        ) : (
          <Text className="text-sm text-muted-foreground mt-1 opacity-60">$0.00</Text>
        )}

        {currency && account && (
          <View className="flex-row items-center gap-2">
            {showBalance && (
              <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
                <Wallet size={16} />{' '}
                {isBalanceLoading ? '...' : formatNumber(Number(balanceString))}
              </Text>
            )}
            {!isBalanceLoading && Number(balanceString) > 0 && showMaxButton && handleMaxValue && (
              <Max onPress={handleMaxValue} />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default memo(TokenCard);
