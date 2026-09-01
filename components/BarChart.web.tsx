import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  YAxis,
} from 'recharts';

import ChartTooltip from '@/components/ChartTooltip';
import { ChartPayload } from '@/lib/types';

interface BarChartProps {
  data: ChartPayload[];
  height?: number;
  compact?: boolean;
  formatToolTip?: (value: number | null) => string;
}

const COMPACT_TOOLTIP_WIDTH = 88;
const COMPACT_TOOLTIP_GAP = 6;

type CompactBarTooltipProps = Partial<TooltipContentProps<number, string>> & {
  data: ChartPayload[];
  height: number;
  formatToolTip?: (value: number | null) => string;
};

const CompactBarTooltip = ({
  active,
  activeIndex,
  coordinate,
  payload,
  data,
  height,
  formatToolTip,
}: CompactBarTooltipProps) => {
  const index = Number(activeIndex);
  const selectedPoint = Number.isInteger(index) ? data[index] : undefined;

  if (!active || !selectedPoint || !coordinate) {
    return null;
  }

  const maxValue = Math.max(...data.map(item => Math.max(item.value, 0)), 0);
  const selectedBarHeight =
    maxValue > 0 ? (Math.max(selectedPoint.value, 0) / maxValue) * height : 0;
  const selectedBarTop = height - selectedBarHeight;
  const tooltipPayload = payload as unknown as { payload: ChartPayload }[];

  return (
    <div
      style={{
        position: 'absolute',
        left: `clamp(0px, ${coordinate.x - COMPACT_TOOLTIP_WIDTH / 2}px, calc(100% - ${COMPACT_TOOLTIP_WIDTH}px))`,
        top: selectedBarTop,
        transform: `translateY(calc(-100% - ${COMPACT_TOOLTIP_GAP}px))`,
        width: COMPACT_TOOLTIP_WIDTH,
      }}
    >
      <ChartTooltip
        active={active}
        payload={tooltipPayload}
        data={data}
        formatToolTip={formatToolTip}
        compact
      />
    </div>
  );
};

const Chart = ({ data, height = 150, compact = false, formatToolTip }: BarChartProps) => {
  return (
    <ResponsiveContainer height={height}>
      <BarChart
        width={500}
        height={420}
        data={data}
        margin={{
          top: compact ? 0 : 10,
          right: 0,
          left: 0,
          bottom: 0,
        }}
        barCategoryGap={compact ? '30%' : undefined}
      >
        <defs>
          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94F27F" stopOpacity={compact ? 1 : 0.8} />
            <stop offset="100%" stopColor="#94F27F" stopOpacity={compact ? 0.15 : 0.3} />
          </linearGradient>
        </defs>

        {compact && <YAxis hide domain={[0, 'dataMax']} />}
        <Tooltip
          content={
            compact ? (
              <CompactBarTooltip data={data} height={height} formatToolTip={formatToolTip} />
            ) : (
              <ChartTooltip data={data} formatToolTip={formatToolTip} />
            )
          }
          trigger={compact ? 'click' : 'hover'}
          shared={compact ? false : undefined}
          cursor={compact ? false : undefined}
          position={compact ? { x: 0, y: 0 } : undefined}
          wrapperStyle={compact ? { width: '100%', height: '100%' } : undefined}
          isAnimationActive={compact ? false : undefined}
        />

        <Bar
          dataKey={'value'}
          fill="url(#colorBar)"
          barSize={compact ? 8 : 7}
          radius={compact ? [4, 4, 4, 4] : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;
