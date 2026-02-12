import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { subMonths } from 'date-fns';

import VaultBreakdownChart from '@/components/Landing/VaultBreakdownChart';
import VaultBreakdownTable from '@/components/Landing/VaultBreakdownTable';
import LazyAreaChart, { ChartFallback } from '@/components/LazyAreaChart';
import SavingsAnalyticsTabs, { Tab } from '@/components/Savings/SavingsAnalyticsTabs';
import SavingsRateTabs, { TimeFilter } from '@/components/Savings/SavingsRateTabs';
import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import { useHistoricalAPY, useVaultBreakdown } from '@/hooks/useAnalytics';
import { ChartPayload } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useSavingStore } from '@/store/useSavingStore';

const CONTENT_MIN_HEIGHT = 200;

const ANIMATION_DURATION = 350;

const SavingsAnalytics = () => {
  const [selectedTab, setSelectedTab] = useState<Tab>(Tab.SAVINGS_RATE);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TimeFilter.ONE_MONTH);
  const [selectedBreakdown, setSelectedBreakdown] = useState(-1);
  const [contentHeight, setContentHeight] = useState(0);
  const selectedVault = useSavingStore(state => state.selectedVault);
  const historicalVault = VAULTS[selectedVault]?.type;

  const containerHeight = useSharedValue(CONTENT_MIN_HEIGHT);
  const isMountedRef = useRef(true);

  const { data: yieldHistory, isLoading: isYieldHistoryLoading } = useHistoricalAPY(
    '-1',
    historicalVault,
  );
  const { data: vaultBreakdown } = useVaultBreakdown();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filteredYieldHistory = useMemo(() => {
    if (!yieldHistory || yieldHistory.length === 0) return [];

    let data: ChartPayload[];
    if (timeFilter === TimeFilter.ALL) {
      data = yieldHistory;
    } else {
      const now = new Date();
      const cutoffDate =
        timeFilter === TimeFilter.ONE_MONTH
          ? subMonths(now, 1)
          : timeFilter === TimeFilter.THREE_MONTHS
            ? subMonths(now, 3)
            : now;
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      data = yieldHistory.filter((item: ChartPayload) => {
        const itemTime =
          typeof item.time === 'string'
            ? item.time
            : new Date(item.time).toISOString().split('T')[0];
        return itemTime >= cutoffDateString;
      });
    }
    return data.filter(item => item.value >= 0 && item.value <= 10);
  }, [yieldHistory, timeFilter]);

  const animateHeight = useCallback(
    (height: number) => {
      if (!isMountedRef.current) return;
      const duration = Platform.OS === 'web' ? ANIMATION_DURATION : 0;
      containerHeight.value = withTiming(height, {
        duration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    },
    [containerHeight],
  );

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

  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    overflow: 'hidden',
  }));

  const formatToolTip = (value: number | null) => {
    if (!value) return '0.00%';
    return `${formatNumber(value, 2)}%`;
  };

  const formatYAxis = (value: number) => {
    return `${formatNumber(value, 1, 0)}%`;
  };

  const content = (
    <>
      {selectedTab === Tab.SAVINGS_RATE && (
        <>
          {isYieldHistoryLoading ? (
            <ChartFallback />
          ) : filteredYieldHistory.length > 0 ? (
            <LazyAreaChart
              data={filteredYieldHistory}
              formatToolTip={formatToolTip}
              formatYAxis={formatYAxis}
              isLabel={false}
              margin={{ right: -20 }}
            />
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
              <VaultBreakdownChart data={vaultBreakdown} selectedBreakdown={selectedBreakdown} />
            </View>
          ) : (
            <View className="h-[200px] items-center justify-center">
              <Text className="text-muted-foreground">No vault breakdown data available</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  const isNative = Platform.OS !== 'web';

  return (
    <View
      className="gap-6 rounded-twice bg-card p-5 md:p-8"
      style={isNative ? { flex: 1, minHeight: 320 } : undefined}
    >
      <View className="w-full items-start gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
        <SavingsAnalyticsTabs selectedTab={selectedTab} onTabChange={setSelectedTab} />
        {selectedTab === Tab.SAVINGS_RATE && (
          <SavingsRateTabs selectedFilter={timeFilter} onFilterChange={setTimeFilter} />
        )}
      </View>

      {isNative ? (
        <View style={{ minHeight: CONTENT_MIN_HEIGHT }}>{content}</View>
      ) : (
        <Animated.View style={containerStyle}>
          <View onLayout={handleContentLayout} style={{ minHeight: CONTENT_MIN_HEIGHT }}>
            {content}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default SavingsAnalytics;
