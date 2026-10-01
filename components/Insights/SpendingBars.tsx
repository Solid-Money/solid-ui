import { useId, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const BRAND = '#94F27F';
const STUB = '#2D2D2D';

/** The brand bar fill, as the vault APY chart draws it: solid at the top, fading down. */
function BarGradient({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={BRAND} stopOpacity={1} />
        <Stop offset="1" stopColor={BRAND} stopOpacity={0.15} />
      </LinearGradient>
    </Defs>
  );
}

const useGradientId = () => `insightsBar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

export type MonthBar = { key: string; label: string; total: number };

type MonthBarsProps = {
  months: MonthBar[];
  selectedKey: string;
  onSelect: (key: string) => void;
  height?: number;
};

/**
 * One column per month; tapping a column selects that month for the whole
 * screen. The selected bar is bright, the rest dimmed — the same selected state
 * as the APY history chart.
 */
export function MonthBars({ months, selectedKey, onSelect, height = 110 }: MonthBarsProps) {
  const gradientId = useGradientId();
  const max = Math.max(...months.map(month => month.total), 0);
  const barWidth = 22;

  return (
    <View className="flex-row justify-around">
      {months.map(month => {
        const selected = month.key === selectedKey;
        const barHeight = max > 0 ? Math.max(6, (month.total / max) * height) : 6;
        return (
          <Pressable
            key={month.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${month.label}, $${month.total.toFixed(2)}`}
            onPress={() => onSelect(month.key)}
            className="items-center gap-2.5 px-2"
            hitSlop={8}
          >
            <Svg width={barWidth} height={height}>
              <BarGradient id={gradientId} />
              <Rect
                x={0}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                fill={month.total > 0 ? `url(#${gradientId})` : STUB}
                opacity={selected ? 1 : 0.4}
              />
            </Svg>
            <Text
              className={cn(
                'text-[13px]',
                selected ? 'font-semibold text-white' : 'font-medium text-white/50',
              )}
            >
              {month.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DailyBarsProps = {
  values: number[];
  /** Days after this index have not happened yet and show as stubs. */
  lastDayIndex?: number;
  height?: number;
  startLabel: string;
  midLabel: string;
  endLabel: string;
};

/** Spend per day across one month: the first-month view, before there is a second to compare. */
export function DailyBars({
  values,
  lastDayIndex = values.length - 1,
  height = 96,
  startLabel,
  midLabel,
  endLabel,
}: DailyBarsProps) {
  const gradientId = useGradientId();
  const [width, setWidth] = useState(0);
  const max = Math.max(...values, 0);
  const slot = width / Math.max(values.length, 1);
  const barWidth = Math.min(7, slot * 0.62);

  return (
    <View>
      <View style={{ height }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <BarGradient id={gradientId} />
            {values.map((value, index) => {
              const x = index * slot + (slot - barWidth) / 2;
              const upcoming = index > lastDayIndex;
              const barHeight =
                !upcoming && max > 0 && value > 0 ? Math.max(4, (value / max) * height) : 4;
              return (
                <Rect
                  key={index}
                  x={x}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={barWidth / 2}
                  fill={!upcoming && value > 0 ? `url(#${gradientId})` : STUB}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View className="mt-2 flex-row justify-between">
        {[startLabel, midLabel, endLabel].map(label => (
          <Text key={label} className="text-xs text-white/40">
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
