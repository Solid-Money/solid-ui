import React from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
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
    <View className="w-full gap-4 rounded-[20px] bg-[#1c1c1c] p-5">
      <View className="gap-1">
        <Text className="text-xs font-medium text-white/70">Total invested</Text>
        <Text className="text-[32px] font-bold leading-tight text-white">
          $
          {totalValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        {hasHoldings && (
          <Text className="text-xs font-medium text-[#94f27f]">
            +${change.toFixed(2)} (+{changePct.toFixed(2)}%) today
          </Text>
        )}
        {!hasHoldings && <Text className="text-xs font-medium text-[#808080]">+$0.00 (0.00%)</Text>}
      </View>

      <View className="flex-row gap-3">
        <Button variant="brand" onPress={onBuyPress} className="flex-1 active:opacity-80">
          <Text className="text-black">Buy</Text>
        </Button>

        <Pressable
          onPress={hasHoldings ? onSellPress : undefined}
          className={`flex-1 items-center justify-center rounded-[12px] bg-[#2a2a2a] py-3 active:opacity-80 ${!hasHoldings ? 'opacity-40' : ''}`}
          disabled={!hasHoldings}
        >
          <Text
            className={`text-sm font-semibold ${hasHoldings ? 'text-white' : 'text-[#808080]'}`}
          >
            Sell
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
