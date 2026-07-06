import React from 'react';
import { View } from 'react-native';
import { LoaderPinwheel } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

type StocksPendingStripProps = {
  message: string;
};

export default function StocksPendingStrip({ message }: StocksPendingStripProps) {
  return (
    <View className="flex-row items-center gap-2.5 px-5 py-3 bg-[#3b2e15]">
      <View className="size-2 rounded-full bg-[#ffd60a]" />
      <Text className="flex-1 text-sm font-medium text-[#ffd60a]">{message}</Text>
      <LoaderPinwheel size={14} color="#ffd60a" />
    </View>
  );
}
