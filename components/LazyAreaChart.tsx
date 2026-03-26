import React, { Component, Suspense } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';

import type { StyleProp, ViewStyle } from 'react-native';

function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return React.lazy(() => {
    const attempt = (retries: number): ReturnType<typeof importFn> =>
      importFn().catch((error: unknown) => {
        if (retries <= 0) throw error;
        return new Promise<{ default: React.ComponentType<any> }>(resolve =>
          setTimeout(() => resolve(attempt(retries - 1)), 1000),
        );
      });
    return attempt(3);
  });
}

const AreaChart = lazyWithRetry(() => import('@/components/AreaChart'));

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

interface ChartErrorBoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="h-[200px] items-center justify-center gap-3">
          <Text className="text-sm text-muted-foreground">Failed to load chart</Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            className="rounded-lg bg-secondary px-4 py-2"
          >
            <Text className="text-sm font-medium">Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const LazyAreaChart = (props: LazyAreaChartProps) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartFallback />}>
      <AreaChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export default LazyAreaChart;
