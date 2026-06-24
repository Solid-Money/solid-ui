import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

type StocksPortfolioCardProps = {
  hasHoldings: boolean;
  totalValue?: number;
  onBuyPress: () => void;
  onSellPress: () => void;
};

export default function StocksPortfolioCard({
  hasHoldings,
  totalValue: totalValueProp,
  onBuyPress,
  onSellPress,
}: StocksPortfolioCardProps) {
  const totalValue = hasHoldings ? (totalValueProp ?? 0) : 0;
  const change = 0;
  const changePct = 0;

  return (
    <View className="rounded-[20px] bg-[#1c1c1c] p-5 gap-4 w-full">
      <View className="gap-1">
        <Text className="text-xs text-white/70 font-medium">Total invested</Text>
        <Text className="text-[32px] font-bold text-white leading-tight">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        {hasHoldings && (
          <Text className="text-xs text-[#94f27f] font-medium">
            +${change.toFixed(2)} (+{changePct.toFixed(2)}%) today
          </Text>
        )}
        {!hasHoldings && (
          <Text className="text-xs text-[#808080] font-medium">+$0.00 (0.00%)</Text>
        )}
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onBuyPress}
          className="flex-1 items-center justify-center py-3 rounded-[12px] bg-[#94f27f] active:opacity-80"
        >
          <Text className="text-sm font-semibold text-black">Buy</Text>
        </Pressable>

        <Pressable
          onPress={hasHoldings ? onSellPress : undefined}
          className={`flex-1 items-center justify-center py-3 rounded-[12px] bg-[#2a2a2a] active:opacity-80 ${!hasHoldings ? 'opacity-40' : ''}`}
          disabled={!hasHoldings}
        >
          <Text className={`text-sm font-semibold ${hasHoldings ? 'text-white' : 'text-[#808080]'}`}>
            Sell
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
