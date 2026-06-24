import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

import { Holding } from './stocksData';
import StockRow from './StockRow';

type StocksHoldingsListProps = {
  holdings: Holding[];
  prices?: Record<string, number>;
  onHoldingPress: (holding: Holding) => void;
};

export default function StocksHoldingsList({
  holdings,
  prices = {},
  onHoldingPress,
}: StocksHoldingsListProps) {
  return (
    <View className="gap-3 px-5 pt-1">
      <Text className="text-lg font-semibold text-white">Your holdings</Text>
      <View className="gap-1">
        {holdings.map(holding => (
          <StockRow
            key={holding.ticker}
            variant="holding"
            ticker={holding.ticker}
            name={holding.name}
            logoColor={holding.logoColor}
            shares={holding.shares}
            changePercent={holding.changePercent}
            price={prices[holding.ticker]}
            onPress={() => onHoldingPress(holding)}
          />
        ))}
      </View>
    </View>
  );
}
