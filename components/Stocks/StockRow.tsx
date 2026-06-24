import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

import Sparkline from './Sparkline';
import StockLogo from './StockLogo';

type StockRowVariant = 'discover' | 'holding';

type StockRowProps = {
  ticker: string;
  name: string;
  logoColor: string;
  logoUrl?: string;
  onPress?: () => void;
} & (
  | {
      variant: 'discover';
      price: number;
      changePercent: number;
      sparklineTrend: 'up' | 'down';
    }
  | {
      variant: 'holding';
      shares: number;
      changePercent: number;
      price?: number;
    }
);

export default function StockRow(props: StockRowProps) {
  const { ticker, name, logoColor, logoUrl, onPress } = props;
  const isPositive = props.changePercent >= 0;
  const changeColor = isPositive ? '#94f27f' : '#ff5e5e';
  const changeSign = isPositive ? '+' : '';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 p-3 active:opacity-70"
    >
      <StockLogo ticker={ticker} logoColor={logoColor} logoUrl={logoUrl} size={40} />

      <View className="flex-1 gap-0.5 min-w-0">
        <Text className="text-sm font-semibold text-white">{ticker}</Text>
        <Text className="text-xs text-[#808080]" numberOfLines={1}>
          {name}
        </Text>
      </View>

      {props.variant === 'discover' && (
        <>
          <View className="px-2">
            <Sparkline trend={props.sparklineTrend} />
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-sm font-semibold text-white">
              ${props.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ color: changeColor }} className="text-xs font-medium">
              {changeSign}{props.changePercent.toFixed(2)}%
            </Text>
          </View>
        </>
      )}

      {props.variant === 'holding' && (
        <View className="items-end gap-0.5">
          <Text className="text-sm font-semibold text-white">
            {props.price != null
              ? `$${(props.shares * props.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${props.shares.toFixed(4)} shares`}
          </Text>
          <Text className="text-xs text-[#808080]">
            {props.shares.toFixed(4)} shares
          </Text>
        </View>
      )}
    </Pressable>
  );
}
