import React from 'react';
import { View } from 'react-native';
import { CandlestickChart } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type StocksEmptyHoldingsProps = {
  onBrowsePress: () => void;
};

export default function StocksEmptyHoldings({ onBrowsePress }: StocksEmptyHoldingsProps) {
  return (
    <View className="items-center gap-4 px-10 py-12">
      <View className="size-16 items-center justify-center rounded-[32px] bg-[#1c1c1c]">
        <CandlestickChart size={32} color="white" />
      </View>
      <Text className="text-center text-lg font-semibold text-white">No investments yet</Text>
      <Text className="text-center text-sm text-white/70">
        Start buying tokenized stocks — self-custodied in your wallet.
      </Text>
      <Button variant="brand" onPress={onBrowsePress} className="active:opacity-80">
        <Text className="text-black">Browse stocks</Text>
      </Button>
    </View>
  );
}
