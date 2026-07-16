import { useMemo } from 'react';
import { View } from 'react-native';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { ChartPayload } from '@/lib/types';

const CHART_HEIGHT = 150;
const BRAND = '#94F27F';

interface SimulateChartProps {
  data: ChartPayload[];
  /** Handle position (series index). */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

/**
 * Default / web-mobile projection chart (recharts). Moving the pointer/finger
 * over the chart updates the active index (the readouts animate); a vertical
 * reference line marks the current handle position. The native drag-handle
 * variant lives in SimulateChart.native.tsx.
 */
const SimulateChart = ({ data, activeIndex, onActiveIndexChange }: SimulateChartProps) => {
  const chartData = useMemo(() => data.map((d, index) => ({ index, value: d.value })), [data]);

  const handleMove = (state: any) => {
    const idx = state?.activeTooltipIndex;
    if (idx !== undefined && idx !== null) {
      onActiveIndexChange(Number(idx));
    }
  };

  if (data.length < 2) return <View style={{ height: CHART_HEIGHT }} />;

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        onMouseMove={handleMove}
        onMouseDown={handleMove}
        onTouchMove={handleMove}
      >
        <defs>
          <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="index" type="number" domain={[0, chartData.length - 1]} hide />
        <YAxis type="number" domain={['dataMin', 'dataMax']} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#simGrad)"
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 5, fill: BRAND, stroke: BRAND }}
        />
        <ReferenceLine x={activeIndex} stroke={BRAND} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default SimulateChart;
