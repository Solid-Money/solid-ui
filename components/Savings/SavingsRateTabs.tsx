import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

export enum TimeFilter {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  ALL = 'ALL',
}

interface SavingsRateTabsProps {
  selectedFilter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
}

const SavingsRateTabs = ({ selectedFilter, onFilterChange }: SavingsRateTabsProps) => {
  return (
    <View className="flex-row gap-2 rounded-full bg-foreground/10 p-1">
      {Object.values(TimeFilter).map(filter => (
        <Pressable
          key={filter}
          onPress={() => onFilterChange(filter)}
          className="shrink-0 px-4 py-2"
        >
          <Text
            className="text-center text-sm font-semibold text-foreground"
            style={{ opacity: selectedFilter === filter ? 1 : 0.6 }}
            numberOfLines={1}
          >
            {filter}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default SavingsRateTabs;
