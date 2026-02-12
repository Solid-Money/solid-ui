import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ChartPayload } from '@/lib/types';

import type { StyleProp, ViewStyle } from 'react-native';

const AreaChart = React.lazy(() => import('@/components/AreaChart'));

interface LazyAreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  isLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
}

export const ChartFallback = () => (
  <View className="h-[200px] items-center justify-center">
    <ActivityIndicator size="large" color="white" />
  </View>
);

const LazyAreaChart = (props: LazyAreaChartProps) => (
  <Suspense fallback={<ChartFallback />}>
    <AreaChart {...props} />
  </Suspense>
);

export default LazyAreaChart;
