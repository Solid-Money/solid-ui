import { Fragment, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';
import { formatChartTooltipDate } from '@/lib/utils/chartDate';

interface BarChartProps {
  data: ChartPayload[];
  height?: number;
  compact?: boolean;
  formatToolTip?: (value: number | null) => string;
}

const TOOLTIP_WIDTH = 112;
const TOOLTIP_HEIGHT = 41;
const TOOLTIP_GAP = 6;

const CompactBars = ({
  data,
  height,
  formatToolTip,
}: {
  data: ChartPayload[];
  height: number;
  formatToolTip?: (value: number | null) => string;
}) => {
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map(item => Math.max(item.value || 0, 0)), 0);
  const verticalPadding = 0;
  const availableHeight = Math.max(height - verticalPadding * 2, 1);
  const slotWidth = width / data.length;
  const barWidth = Math.min(8, slotWidth * 0.62);
  const selectedPoint = selectedIndex === null ? null : data[selectedIndex];
  const selectedBarCenter = selectedIndex === null ? 0 : (selectedIndex + 0.5) * slotWidth;
  const selectedBarHeight = selectedPoint
    ? maxValue > 0
      ? (Math.max(selectedPoint.value, 0) / maxValue) * availableHeight
      : 0
    : 0;
  const selectedBarTop = verticalPadding + availableHeight - selectedBarHeight;
  const tooltipLeft = Math.max(
    0,
    Math.min(selectedBarCenter - TOOLTIP_WIDTH / 2, width - TOOLTIP_WIDTH),
  );
  const tooltipTop = selectedBarTop - TOOLTIP_HEIGHT - TOOLTIP_GAP;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Historical APY bar chart. Tap a bar to show its APY and date."
      style={{ width: '100%', height }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="apyHistoryBarGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#94F27F" stopOpacity={1} />
              <Stop offset="1" stopColor="#94F27F" stopOpacity={0.15} />
            </LinearGradient>
          </Defs>
          {data.map((item, index) => {
            const barHeight =
              maxValue > 0 ? (Math.max(item.value || 0, 0) / maxValue) * availableHeight : 0;
            const x = index * slotWidth + (slotWidth - barWidth) / 2;
            const y = verticalPadding + availableHeight - barHeight;

            return (
              <Fragment key={`${item.time}-${index}`}>
                <Rect
                  x={index * slotWidth}
                  y={0}
                  width={slotWidth}
                  height={height}
                  fill="transparent"
                  accessible
                  accessibilityLabel={`${formatToolTip ? formatToolTip(item.value) : `${item.value.toFixed(2)}%`}, ${formatChartTooltipDate(item.time)}`}
                  onPress={() => setSelectedIndex(current => (current === index ? null : index))}
                />
                <Rect
                  pointerEvents="none"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={barWidth / 2}
                  fill="url(#apyHistoryBarGradient)"
                  opacity={selectedIndex === null || selectedIndex === index ? 1 : 0.58}
                />
              </Fragment>
            );
          })}
        </Svg>
      )}

      {selectedPoint && width > 0 && (
        <View
          pointerEvents="none"
          className="absolute z-10 rounded-lg bg-white px-2 py-1.5 shadow-md"
          style={{ left: tooltipLeft, top: tooltipTop, width: TOOLTIP_WIDTH }}
        >
          <Text className="text-[13px] font-semibold leading-[15px] text-black">
            {formatToolTip
              ? formatToolTip(selectedPoint.value)
              : `${selectedPoint.value.toFixed(2)}%`}
          </Text>
          <Text className="mt-0.5 text-[10px] leading-3 text-black/50">
            {formatChartTooltipDate(selectedPoint.time)}
          </Text>
        </View>
      )}
    </View>
  );
};

const Chart = ({ data, height = 150, compact = false, formatToolTip }: BarChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  if (compact) {
    return <CompactBars data={data} height={height} formatToolTip={formatToolTip} />;
  }

  const maxValue = Math.max(...data.map(item => item.value || 0));
  const latestValue = data[data.length - 1]?.value;
  const avgValue = data.reduce((acc, item) => acc + (item.value || 0), 0) / data.length;

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <View className="items-center gap-2">
        <Text className="text-xs text-muted-foreground">Current APY</Text>
        <Text className="text-3xl font-semibold">
          {formatToolTip ? formatToolTip(latestValue || null) : `${latestValue?.toFixed(2)}%`}
        </Text>
      </View>
      <View className="flex-row gap-6">
        <View className="items-center gap-1">
          <Text className="text-xs text-muted-foreground">30d Avg</Text>
          <Text className="text-sm font-medium">
            {formatToolTip ? formatToolTip(avgValue) : `${avgValue.toFixed(2)}%`}
          </Text>
        </View>
        <View className="items-center gap-1">
          <Text className="text-xs text-muted-foreground">30d Max</Text>
          <Text className="text-sm font-medium">
            {formatToolTip ? formatToolTip(maxValue) : `${maxValue.toFixed(2)}%`}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Chart;
