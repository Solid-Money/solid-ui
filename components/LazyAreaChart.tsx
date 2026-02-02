import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ChartPayload } from '@/lib/types';

import type { StyleProp, ViewStyle } from 'react-native';

// Lazy load the heavy chart component (victory-native ~1.2MB, recharts ~400KB)
// This defers loading until the chart is actually needed
const AreaChart = React.lazy(() => import('@/components/AreaChart'));

interface LazyAreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
}

export const ChartFallback = () => (
  <View className="h-[200px] items-center justify-center">
    <ActivityIndicator size="large" color="white" />
  </View>
);

/**
 * LazyAreaChart - Lazy-loaded wrapper for AreaChart
 *
 * Benefits:
 * - Defers loading of victory-native (~1.2MB) and recharts (~400KB) until needed
 * - Improves initial bundle size and FCP for screens that don't show charts
 * - Shows a loading spinner while the chart component loads
 */
const LazyAreaChart = ({ data, formatToolTip, formatYAxis, style, margin }: LazyAreaChartProps) => {
  return (
    <Suspense fallback={<ChartFallback />}>
      <AreaChart
        data={data}
        formatToolTip={formatToolTip}
        formatYAxis={formatYAxis}
        style={style}
        margin={margin}
      />
    </Suspense>
  );
};

export default LazyAreaChart;
