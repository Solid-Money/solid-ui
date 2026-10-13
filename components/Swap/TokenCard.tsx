import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { Wallet } from 'lucide-react-native';

import Max from '@/components/Max';
import SwapTokenSelectorModal from '@/components/TokenSelector/SwapTokenSelectorModal';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { formatNumber } from '@/lib/utils';

interface TokenCardProps {
  handleTokenSelection: (asset: SwapAsset) => void;
  handleValueChange?: (value: string) => void;
  handleMaxValue?: () => void;
  value: string;
  asset: SwapAsset | undefined;
  otherAsset: SwapAsset | undefined;
  /** In human units. Undefined while it loads. */
  balance: number | undefined;
  fiatValue?: number;
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
  asset,
  otherAsset,
  balance,
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

  // Track amount entry start (once per swap session)
  const hasTrackedAmountEntry = useRef(false);

  useEffect(() => {
    if (value && !hasTrackedAmountEntry.current && !disabled) {
      hasTrackedAmountEntry.current = true;
      track(TRACKING_EVENTS.SWAP_AMOUNT_ENTRY_STARTED, {
        field: title || 'unknown',
        currency_symbol: asset?.symbol,
      });
    }
  }, [value, disabled, title, asset?.symbol]);

  // Track token selector opened
  useEffect(() => {
    if (open) {
      track(TRACKING_EVENTS.SWAP_TOKEN_SELECTOR_OPENED, {
        field: title || 'unknown',
        current_currency: asset?.symbol,
        current_chain_id: asset?.chainId,
      });
    }
  }, [open, title, asset?.symbol, asset?.chainId]);

  const isBalanceLoading = balance === undefined;
  const balanceValue = balance && !isNaN(balance) ? balance : 0;

  const balanceString = useMemo(() => {
    if (isBalanceLoading) return '...';
    return `${formatNumber(balanceValue)} ${asset?.symbol ?? ''}`;
  }, [isBalanceLoading, balanceValue, asset?.symbol]);

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
    <View className="flex w-full flex-col gap-3">
      {title && (
        <View className="flex-row items-center justify-between gap-2 px-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-medium tracking-wide text-white/70">{title}</Text>
            {asset && (
              <Text className="text-sm font-medium text-white/40">
                {CHAIN_NAMES[asset.chainId] ?? ''}
              </Text>
            )}
          </View>
          {asset && account && (
            <View className="flex-row items-center gap-2">
              {showBalance && (
                <View className="flex-row items-center gap-1.5">
                  <Wallet
                    size={16}
                    color={Platform.OS === 'web' ? undefined : 'rgb(161, 161, 161)'}
                    className="text-muted-foreground"
                  />
                  <Text className="text-left text-base font-medium text-white/50">
                    {isBalanceLoading ? '...' : balanceString}
                  </Text>
                </View>
              )}
              {!isBalanceLoading && balanceValue > 0 && showMaxButton && handleMaxValue && (
                <Max onPress={handleMaxValue} />
              )}
            </View>
          )}
        </View>
      )}

      <View className="flex w-full flex-row items-center rounded-2xl bg-card px-4 py-3 transition-all duration-300 ease-out">
        <View className="mr-4 flex-1 flex-col justify-center">
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
                fontWeight: '600',
                padding: 0,
              }}
              editable={!disabled}
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
            />
          )}

          <View className="flex-row items-center">
            {fiatValue && fiatValue > 0 ? (
              <Text className="text-base text-muted-foreground">${fiatValue.toFixed(2)}</Text>
            ) : value && Number(value) > 0 ? (
              <Text className="text-base text-muted-foreground opacity-60">~$0.00</Text>
            ) : (
              <Text className="text-base text-muted-foreground opacity-60">$0.00</Text>
            )}
          </View>
        </View>

        <SwapTokenSelectorModal
          open={open}
          setOpen={setOpen}
          onSelect={handleTokenSelection}
          currentAsset={asset}
          otherAsset={otherAsset}
          showNativeToken={showNativeToken}
        />
      </View>
    </View>
  );
};

export default memo(TokenCard);
