import React from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { ChevronDown, Wallet } from 'lucide-react-native';

import { MaxPill } from '@/components/Send/CrossChain/shared';
import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Text } from '@/components/ui/text';
import { assetDisplayName } from '@/lib/swapAssets';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { cn } from '@/lib/utils';
import { formatSwapUsd, groupAmountInput } from '@/lib/utils/swap/format';

type SwapAmountCardProps = {
  label: 'You pay' | 'You get';
  asset: SwapAsset | undefined;
  /** "18.43 USD Yield", beside the wallet icon. */
  balanceLabel?: string;
  onMax?: () => void;
  /** Raw typed amount, or the formatted quote on "You get". */
  value: string;
  /** Present on "You pay" only; "You get" is read-only. */
  onChangeText?: (text: string) => void;
  /** Shown in place of the amount while it loads: "Getting price…". */
  pendingLabel?: string;
  usd?: number;
  /** The amount is more than the balance: shown in red. */
  invalid?: boolean;
  onPickAsset: () => void;
};

/** One side of the swap: the amount, its dollar value, and the coin it's in. */
const SwapAmountCard = ({
  label,
  asset,
  balanceLabel,
  onMax,
  value,
  onChangeText,
  pendingLabel,
  usd,
  invalid,
  onPickAsset,
}: SwapAmountCardProps) => {
  const name = asset ? assetDisplayName(asset) : 'Select';
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2 px-1">
        <Text className="text-base text-white/70">{label}</Text>
        {balanceLabel ? (
          <View className="flex-row items-center gap-1.5">
            <Wallet
              size={14}
              color={Platform.OS === 'web' ? undefined : 'rgba(255,255,255,0.5)'}
              className="text-white/50"
            />
            <Text className="text-sm text-white/50">{balanceLabel}</Text>
            {onMax ? <MaxPill onPress={onMax} /> : null}
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3 rounded-[15px] bg-card px-[18px] py-4">
        <View className="flex-1 gap-1">
          {pendingLabel ? (
            <Text className="text-xl leading-[40px] text-white/50">{pendingLabel}</Text>
          ) : onChangeText ? (
            <TextInput
              value={groupAmountInput(value)}
              onChangeText={onChangeText}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel={`${label} amount`}
              className={cn(
                'text-[34px] font-semibold leading-[40px] web:focus:outline-none',
                invalid ? 'text-red-400' : 'text-white',
              )}
              style={{ padding: 0 }}
            />
          ) : (
            <Text
              numberOfLines={1}
              className={cn(
                'text-[34px] font-semibold leading-[40px]',
                value ? 'text-white' : 'text-white/30',
              )}
            >
              {value || '0'}
            </Text>
          )}
          <Text className="text-sm text-white/50">
            {usd !== undefined ? formatSwapUsd(usd) : value && !pendingLabel ? '—' : '$0.00'}
          </Text>
        </View>

        <Pressable
          onPress={onPickAsset}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${name}. Change coin`}
          className="h-[45px] flex-row items-center gap-1.5 rounded-full bg-[#333] px-3 web:hover:bg-[#3a3a3a]"
        >
          <SwapAssetLogo asset={asset} size={26} />
          <Text className="text-base font-medium text-white">{name}</Text>
          <ChevronDown size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
};

export default SwapAmountCard;
