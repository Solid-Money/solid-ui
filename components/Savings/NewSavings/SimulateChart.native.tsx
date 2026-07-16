import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { LineChart } from 'react-native-wagmi-charts';
import { scheduleOnRN } from 'react-native-worklets';
import { ChevronsLeftRight } from 'lucide-react-native';

import { ChartPayload } from '@/lib/types';

const CHART_HEIGHT = 150;
const BRAND = '#94F27F';

/**
 * Bridges the wagmi chart's draggable cursor (a worklet shared value) back to JS
 * so the parent can update the future-balance / earned readouts. Renders nothing;
 * must live inside LineChart.Provider.
 */
const CursorReactor = ({
  count,
  onActiveIndexChange,
}: {
  count: number;
  onActiveIndexChange: (index: number) => void;
}) => {
  const { currentIndex, isActive } = LineChart.useChart();

  const report = useCallback(
    (index: number, active: boolean) => {
      if (active && index >= 0 && index < count) {
        onActiveIndexChange(index);
      }
    },
    [count, onActiveIndexChange],
  );

  useAnimatedReaction(
    () => ({ index: currentIndex.value, active: isActive.value }),
    (current, previous) => {
      if (current.index !== previous?.index || current.active !== previous?.active) {
        scheduleOnRN(report, current.index, current.active);
      }
    },
    [report],
  );

  return null;
};

interface SimulateChartProps {
  data: ChartPayload[];
  /** Resting handle position (series index). */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

/**
 * Native projection chart: a wagmi LineChart whose draggable crosshair drives the
 * readouts, plus a resting "chevron handle" (vertical guide + circular grip) at
 * the active index — matching the mockup's left/right drag handle.
 */
const SimulateChart = ({ data, activeIndex, onActiveIndexChange }: SimulateChartProps) => {
  const [width, setWidth] = useState<number | undefined>(undefined);

  const wagmiData = useMemo(
    () =>
      data.map(d => ({
        timestamp: typeof d.time === 'string' ? new Date(d.time).getTime() : d.time,
        value: d.value,
      })),
    [data],
  );

  if (data.length < 2) return <View style={{ height: CHART_HEIGHT }} />;

  const handleX = width ? (activeIndex / (data.length - 1)) * width : 0;

  return (
    <View style={{ height: CHART_HEIGHT }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width !== undefined && (
        <>
          <LineChart.Provider data={wagmiData}>
            <LineChart height={CHART_HEIGHT} width={width}>
              <LineChart.Path color={BRAND} width={2}>
                <LineChart.Gradient color={BRAND} />
              </LineChart.Path>
              <LineChart.CursorCrosshair color={BRAND} size={8} outerSize={18} snapToPoint />
            </LineChart>
            <CursorReactor count={data.length} onActiveIndexChange={onActiveIndexChange} />
          </LineChart.Provider>

          {/* Resting handle (drag feedback comes from the crosshair above). */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: handleX - 1,
              width: 2,
              backgroundColor: 'rgba(148, 242, 127, 0.45)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: CHART_HEIGHT / 2 - 16,
              left: handleX - 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: BRAND,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronsLeftRight size={16} color="#0A0A0A" />
          </View>
        </>
      )}
    </View>
  );
};

export default SimulateChart;
