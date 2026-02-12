import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

export enum TimeFilter {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  ALL = 'ALL',
}

interface SavingsRateTabsProps {
  selectedFilter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
}

const RATE_TABS_MAX_WIDTH = 280;

const SavingsRateTabs = ({ selectedFilter, onFilterChange }: SavingsRateTabsProps) => {
  const { isScreenMedium } = useDimension();
  return (
    <View
      className="flex-row gap-2 rounded-full bg-foreground/10 p-1"
      style={{
        width: isScreenMedium ? undefined : '100%',
        maxWidth: isScreenMedium ? RATE_TABS_MAX_WIDTH : undefined,
      }}
    >
      {Object.values(TimeFilter).map(filter => (
        <Pressable
          key={filter}
          onPress={() => onFilterChange(filter)}
          className="flex-1 shrink-0 px-4 py-1 md:flex-none md:py-2"
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
