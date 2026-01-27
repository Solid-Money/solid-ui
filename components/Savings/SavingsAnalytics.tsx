import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { subMonths } from 'date-fns';

import VaultBreakdownChart from '@/components/Landing/VaultBreakdownChart';
import VaultBreakdownTable from '@/components/Landing/VaultBreakdownTable';
import LazyAreaChart from '@/components/LazyAreaChart';
import SavingsAnalyticsTabs, { Tab } from '@/components/Savings/SavingsAnalyticsTabs';
import SavingsRateTabs, { TimeFilter } from '@/components/Savings/SavingsRateTabs';
import { Text } from '@/components/ui/text';
import { useHistoricalAPY, useVaultBreakdown } from '@/hooks/useAnalytics';
import { ChartPayload } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const ANIMATION_DURATION = 350;

const SavingsAnalytics = () => {
  const [selectedTab, setSelectedTab] = useState<Tab>(Tab.SAVINGS_RATE);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TimeFilter.ONE_MONTH);
  const [selectedBreakdown, setSelectedBreakdown] = useState(-1);
  const [contentHeight, setContentHeight] = useState(0);

  const containerHeight = useSharedValue(0);
  const isMountedRef = useRef(true);

  // Fetch all historical data
  const { data: yieldHistory, isLoading: isYieldHistoryLoading } = useHistoricalAPY('-1');
  const { data: vaultBreakdown } = useVaultBreakdown();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Filter yield history data based on time filter
  const filteredYieldHistory = useMemo(() => {
    if (!yieldHistory || yieldHistory.length === 0) return [];

    if (timeFilter === TimeFilter.ALL) {
      return yieldHistory;
    }

    const now = new Date();
    const cutoffDate =
      timeFilter === TimeFilter.ONE_MONTH
        ? subMonths(now, 1)
        : timeFilter === TimeFilter.THREE_MONTHS
          ? subMonths(now, 3)
          : now;
    const cutoffTime = cutoffDate.getTime();

    return yieldHistory.filter((item: ChartPayload) => item.time >= cutoffTime);
  }, [yieldHistory, timeFilter]);

  // Animate container height
  const animateHeight = useCallback(
    (height: number) => {
      if (!isMountedRef.current) return;
      containerHeight.value = withTiming(height, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    },
    [containerHeight],
  );

  // Handle content layout
  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isMountedRef.current) return;
      const { height } = event.nativeEvent.layout;
      if (height !== contentHeight) {
        setContentHeight(height);
        animateHeight(height);
      }
    },
    [contentHeight, animateHeight],
  );

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    overflow: 'hidden',
  }));

  const formatToolTip = (value: number | null) => {
    if (!value) return '0.00%';
    return `${formatNumber(value, 2)}%`;
  };

  return (
    <View className="gap-6 rounded-twice bg-card p-5 md:p-8">
      <View className="flex-row items-center justify-between gap-2">
        <SavingsAnalyticsTabs selectedTab={selectedTab} onTabChange={setSelectedTab} />
        {selectedTab === Tab.SAVINGS_RATE && (
          <SavingsRateTabs selectedFilter={timeFilter} onFilterChange={setTimeFilter} />
        )}
      </View>

      {/* Content */}
      <Animated.View style={containerStyle}>
        <View onLayout={handleContentLayout}>
          {/* Area Chart */}
          {selectedTab === Tab.SAVINGS_RATE && (
            <>
              {isYieldHistoryLoading ? (
                <View className="h-[200px] items-center justify-center">
                  <Text className="text-muted-foreground">Loading...</Text>
                </View>
              ) : filteredYieldHistory.length > 0 ? (
                <LazyAreaChart data={filteredYieldHistory} formatToolTip={formatToolTip} />
              ) : (
                <View className="h-[200px] items-center justify-center">
                  <Text className="text-muted-foreground">No data available</Text>
                </View>
              )}
            </>
          )}

          {selectedTab === Tab.VAULT_BREAKDOWN && (
            <>
              {vaultBreakdown && vaultBreakdown.length > 0 ? (
                <View className="flex-col gap-4 md:flex-row md:justify-between">
                  <VaultBreakdownTable
                    data={vaultBreakdown}
                    setSelectedBreakdown={setSelectedBreakdown}
                    className="max-w-[45rem]"
                  />
                  <VaultBreakdownChart
                    data={vaultBreakdown}
                    selectedBreakdown={selectedBreakdown}
                  />
                </View>
              ) : (
                <View className="h-[200px] items-center justify-center">
                  <Text className="text-muted-foreground">No vault breakdown data available</Text>
                </View>
              )}
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

export default SavingsAnalytics;
