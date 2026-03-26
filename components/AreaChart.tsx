import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { scheduleOnRN } from 'react-native-worklets';
import { useShallow } from 'zustand/react/shallow';

import { calculatePercentageChange } from '@/components/ChartTooltip';
import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { formatChartAxisLabel, formatChartTooltipDate } from '@/lib/utils/chartDate';
import { useCoinStore } from '@/store/useCoinStore';

import type { StyleProp, ViewStyle } from 'react-native';

interface AreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  isLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
}

const CHART_HEIGHT = 300;
const Y_AXIS_WIDTH = 70;
const X_AXIS_HEIGHT = 30;
const CHART_AREA_HEIGHT = CHART_HEIGHT - X_AXIS_HEIGHT;
const Y_TICK_COUNT = 4;
const X_TICK_COUNT = 4;

const ChartContent = ({
  data,
  formatToolTip,
  formatYAxis,
  isLabel = true,
  chartWidth,
}: {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  isLabel: boolean;
  chartWidth?: number;
}) => {
  const { setSelectedPrice, setSelectedPriceChange } = useCoinStore(
    useShallow(state => ({
      setSelectedPrice: state.setSelectedPrice,
      setSelectedPriceChange: state.setSelectedPriceChange,
    })),
  );

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    price: string;
    date: string;
    priceChange: number | null;
  } | null>(null);

  const { currentIndex, isActive } = LineChart.useChart();

  const syncStore = useCallback(
    (index: number, active: boolean) => {
      if (active && index >= 0 && index < data.length) {
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

          const format = (value: number | null) => {
            if (!value) return '$0.00';
            return `$${formatNumber(value)}`;
          };

          const prevData = index > 0 ? data[index - 1] : null;
          const change =
            prevData && currentData
              ? calculatePercentageChange(prevData.value, currentData.value)
              : null;

          setTooltipData({
            price: formatToolTip ? formatToolTip(currentData.value) : format(currentData.value),
            date: formatChartTooltipDate(currentData.time),
            priceChange: change,
          });
          setTooltipVisible(true);
        }
      } else {
        setSelectedPrice(null);
        setSelectedPriceChange(null);
        setTooltipVisible(false);
        setTooltipData(null);
      }
    },
    [data, formatToolTip, setSelectedPrice, setSelectedPriceChange],
  );

  useAnimatedReaction(
    () => ({
      index: currentIndex.value,
      active: isActive.value,
    }),
    (current, previous) => {
      if (current.index !== previous?.index || current.active !== previous?.active) {
        scheduleOnRN(syncStore, current.index, current.active);
      }
    },
    [syncStore],
  );

  useEffect(() => {
    return () => {
      setSelectedPrice(null);
      setSelectedPriceChange(null);
    };
  }, [setSelectedPrice, setSelectedPriceChange]);

  // Compute Y-axis tick labels
  const yTicks = useMemo(() => {
    if (!data || data.length < 2) return [];
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.1;
    const minVal = min - padding;
    const maxVal = max + padding;
    const step = (maxVal - minVal) / (Y_TICK_COUNT - 1);

    const defaultFormat = (value: number) => {
      if (value === 0) return '$0';
      const abs = Math.abs(value);
      if (abs >= 1) return `$${formatNumber(value, 1, 0)}`;
      const maxDigits = Math.min(8, Math.max(2, Math.ceil(-Math.log10(abs)) + 2));
      return `$${formatNumber(value, maxDigits, 0)}`;
    };

    const formatter = formatYAxis || defaultFormat;
    const ticks = [];
    for (let i = 0; i < Y_TICK_COUNT; i++) {
      const val = minVal + step * i;
      // Position: 0 = bottom of chart, 1 = top
      const pct = i / (Y_TICK_COUNT - 1);
      ticks.push({ label: formatter(val), pct });
    }
    return ticks;
  }, [data, formatYAxis]);

  // Compute X-axis tick labels
  const xTicks = useMemo(() => {
    if (!data || data.length < 2) return [];
    const maxIndex = Math.floor(data.length * 0.9);
    const step = Math.max(1, Math.floor(maxIndex / (X_TICK_COUNT - 1)));
    const ticks = [];
    for (let i = 0; i < maxIndex; i += step) {
      ticks.push({
        label: formatChartAxisLabel(data[i].time),
        pct: i / (data.length - 1),
      });
    }
    return ticks;
  }, [data]);

  return (
    <>
      {/* Chart + Y-axis side by side */}
      <View style={{ flexDirection: 'row', height: CHART_AREA_HEIGHT }}>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <LineChart height={CHART_AREA_HEIGHT} width={chartWidth} yGutter={16}>
            <LineChart.Path color="#94F27F" width={1}>
              <LineChart.Gradient color="#94F27F" />
            </LineChart.Path>
            <LineChart.CursorCrosshair color="#94F27F" size={8} outerSize={20} snapToPoint />
          </LineChart>
        </View>
        {/* Y-axis labels */}
        {isLabel && (
          <View
            style={{
              width: Y_AXIS_WIDTH,
              height: CHART_AREA_HEIGHT,
              justifyContent: 'space-between',
              paddingVertical: 4,
            }}
            pointerEvents="none"
          >
            {[...yTicks].reverse().map((tick, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'right',
                  paddingRight: 4,
                }}
              >
                {tick.label}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* X-axis labels */}
      {isLabel && (
        <View
          style={{
            height: X_AXIS_HEIGHT,
            marginRight: Y_AXIS_WIDTH,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-evenly',
              paddingTop: 8,
            }}
          >
            {xTicks.map((tick, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'center',
                }}
              >
                {tick.label}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Tooltip */}
      {tooltipVisible && tooltipData && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            minWidth: 140,
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
            {tooltipData.price}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {tooltipData.priceChange !== null && (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: tooltipData.priceChange < 0 ? '#EF4444' : '#22C55E',
                }}
              >
                {formatNumber(tooltipData.priceChange, 2)}%
              </Text>
            )}
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>{tooltipData.date}</Text>
          </View>
        </View>
      )}
    </>
  );
};

const Chart = ({ data, formatToolTip, formatYAxis, isLabel = true, style }: AreaChartProps) => {
  const [chartWidth, setChartWidth] = useState<number | undefined>(undefined);

  const wagmiData = useMemo(() => {
    if (!data || data.length < 2) return null;

    return data.map(d => ({
      timestamp: typeof d.time === 'string' ? new Date(d.time).getTime() : d.time,
      value: d.value,
    }));
  }, [data]);

  if (!wagmiData) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }

  return (
    <View
      style={[{ height: CHART_HEIGHT, overflow: 'hidden' }, style]}
      onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth !== undefined && (
        <LineChart.Provider data={wagmiData}>
          <ChartContent
            data={data}
            formatToolTip={formatToolTip}
            formatYAxis={formatYAxis}
            isLabel={isLabel}
            chartWidth={chartWidth}
          />
        </LineChart.Provider>
      )}
    </View>
  );
};

export default Chart;
