import { useCallback, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, useWindowDimensions, View } from 'react-native';
import { Defs, LinearGradient, Stop } from 'react-native-svg';
import { VictoryArea, VictoryAxis, VictoryChart } from 'victory-native';
import { useShallow } from 'zustand/react/shallow';

import { calculatePercentageChange } from '@/components/ChartTooltip';
import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';
import { formatChartAxisLabel, formatChartTooltipDate } from '@/lib/utils/chartDate';
import { formatNumber } from '@/lib/utils';
import { useCoinStore } from '@/store/useCoinStore';
import type { StyleProp, ViewStyle } from 'react-native';

interface AreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
}

const CHART_HEIGHT = 300;
const CHART_PADDING = { top: 10, bottom: 60, left: 0, right: 70 };

// Throttle interval for touch events (~30fps for smooth performance on Android)
const TOUCH_THROTTLE_MS = 32;

const Chart = ({ data, formatToolTip, formatYAxis, style }: AreaChartProps) => {
  const { setSelectedPrice, setSelectedPriceChange } = useCoinStore(
    useShallow(state => ({
      setSelectedPrice: state.setSelectedPrice,
      setSelectedPriceChange: state.setSelectedPriceChange,
    })),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [touchX, setTouchX] = useState<number>(0);
  const lastTouchTime = useRef(0);

  const { width: screenWidth } = useWindowDimensions();

  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    return data.map((d, index) => ({
      x: index,
      y: d.value,
      time: d.time,
    }));
  }, [data]);

  // Get x-axis tick values and labels
  const xAxisTicks = useMemo(() => {
    if (!data || data.length < 2) return { ticks: [], labels: [] };
    const tickCount = Math.min(5, data.length);
    // Exclude last 10% of data points to avoid overlap with y-axis
    const maxIndex = Math.floor(data.length * 0.9);
    const step = Math.max(1, Math.floor(maxIndex / (tickCount - 1)));
    const ticks: number[] = [];
    const labels: string[] = [];
    for (let i = 0; i < maxIndex; i += step) {
      ticks.push(i);
      labels.push(formatChartAxisLabel(data[i].time));
    }
    return { ticks, labels };
  }, [data]);

  // Get y-axis tick values
  const yAxisTicks = useMemo(() => {
    if (!data || data.length < 2) return [];
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.1;
    const minValue = min - padding;
    const maxValue = max + padding;
    const tickCount = 5;
    const step = (maxValue - minValue) / (tickCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(minValue + step * i);
    }
    return ticks;
  }, [data]);

  // Calculate min/max for Y position calculation
  const { minValue, maxValue } = useMemo(() => {
    if (!data || data.length < 2) return { minValue: 0, maxValue: 1 };
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Add padding like domainPadding does
    const range = max - min || 1;
    const padding = range * 0.1;
    return {
      minValue: min - padding,
      maxValue: max + padding,
    };
  }, [data]);

  // Convert data value to Y pixel position
  const getYPosition = useCallback(
    (value: number) => {
      const chartAreaHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
      const range = maxValue - minValue || 1;
      const normalizedValue = (value - minValue) / range;
      // Invert because screen Y increases downward
      return CHART_PADDING.top + chartAreaHeight * (1 - normalizedValue);
    },
    [minValue, maxValue],
  );

  const getIndexFromX = useCallback(
    (locationX: number) => {
      if (!data || data.length < 2) return null;
      const index = Math.round((locationX / screenWidth) * (data.length - 1));
      return Math.max(0, Math.min(data.length - 1, index));
    },
    [data, screenWidth],
  );

  const handleTouch = useCallback(
    (evt: GestureResponderEvent) => {
      // Throttle touch events to reduce JS thread load on Android
      const now = Date.now();
      if (now - lastTouchTime.current < TOUCH_THROTTLE_MS) return;
      lastTouchTime.current = now;

      const { locationX } = evt.nativeEvent;
      const index = getIndexFromX(locationX);
      if (index === null) return;

      setActiveIndex(index);
      setTouchX(locationX);

      const currentData = data[index];
      if (currentData) {
        setSelectedPrice(currentData.value);

        if (index > 0) {
          const previousPrice = data[index - 1]?.value;
          if (previousPrice) {
            const priceChange = calculatePercentageChange(previousPrice, currentData.value);
            if (priceChange) {
              setSelectedPriceChange(priceChange);
            }
          }
        }
      }
    },
    [data, getIndexFromX, setSelectedPrice, setSelectedPriceChange],
  );

  const handleTouchEnd = useCallback(() => {
    setActiveIndex(null);
  }, []);

  if (!chartData) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }

  const activeData = activeIndex !== null ? data[activeIndex] : null;
  const previousData = activeIndex !== null && activeIndex > 0 ? data[activeIndex - 1] : null;
  const priceChange =
    activeData && previousData
      ? calculatePercentageChange(previousData.value, activeData.value)
      : null;

  const format = (value: number | null) => {
    if (!value) return `$0.00`;
    return `$${formatNumber(value)}`;
  };

  const TOOLTIP_WIDTH = 140;

  // Position tooltip to the right of touch, or left if near edge
  const tooltipLeft =
    touchX + 20 + TOOLTIP_WIDTH > screenWidth ? touchX - TOOLTIP_WIDTH - 10 : touchX + 20;

  return (
    <View style={[{ height: CHART_HEIGHT }, style]}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        <VictoryChart
          width={screenWidth}
          height={CHART_HEIGHT}
          padding={CHART_PADDING}
          domainPadding={{ y: 10 }}
        >
          <Defs>
            <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#94F27F" stopOpacity={0.15} />
              <Stop offset="100%" stopColor="#94F27F" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <VictoryAxis
            tickValues={xAxisTicks.ticks}
            tickFormat={t => {
              const index = Math.round(t);
              return index >= 0 && index < xAxisTicks.labels.length ? xAxisTicks.labels[index] : '';
            }}
            style={{
              axis: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: { fill: 'rgba(255, 255, 255, 0.5)', fontSize: 14 },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryAxis
            dependentAxis
            orientation="right"
            tickValues={yAxisTicks}
            tickFormat={t => {
              if (typeof t !== 'number' || !isFinite(t)) return formatYAxis ? formatYAxis(0) : '0';
              return formatYAxis ? formatYAxis(t) : `${formatNumber(t, 1, 0)}`;
            }}
            style={{
              axis: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: { fill: 'rgba(255, 255, 255, 0.5)', fontSize: 14 },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryArea
            data={chartData}
            interpolation="linear"
            style={{
              data: {
                fill: 'url(#areaGradient)',
                stroke: '#94F27F',
                strokeWidth: 2,
              },
            }}
          />
        </VictoryChart>
      </View>
      {/* Dot indicator - simple clean dot matching web */}
      {activeIndex !== null && activeData && (
        <View
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#94F27F',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            left: touchX - 5,
            top: getYPosition(activeData.value) - 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 3,
          }}
          pointerEvents="none"
        />
      )}
      {/* Tooltip - white background matching web exactly */}
      {activeIndex !== null && activeData && (
        <View
          style={{
            position: 'absolute',
            left: tooltipLeft,
            top: Math.max(8, getYPosition(activeData.value) - 30),
            minWidth: TOOLTIP_WIDTH,
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#18181B' }}>
            {formatToolTip ? formatToolTip(activeData.value) : format(activeData.value)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {priceChange !== null && (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: priceChange < 0 ? '#EF4444' : '#22C55E',
                }}
              >
                {formatNumber(priceChange, 2)}%
              </Text>
            )}
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>
              {formatChartTooltipDate(activeData.time)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default Chart;
