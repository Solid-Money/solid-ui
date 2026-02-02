import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import ChartTooltip from '@/components/ChartTooltip';
import { ChartPayload } from '@/lib/types';
import { formatChartAxisLabel } from '@/lib/utils/chartDate';
import { formatNumber } from '@/lib/utils';

const DEFAULT_MARGIN = { top: 10, right: 0, left: 0, bottom: 0 };

interface AreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  formatYAxis?: (value: number) => string;
  style?: React.CSSProperties;
  margin?: Partial<typeof DEFAULT_MARGIN>;
}

const Chart = ({ data, formatToolTip, formatYAxis, style, margin }: AreaChartProps) => {
  const chartMargin = { ...DEFAULT_MARGIN, ...margin };
  // Transform data to include index for x-axis
  const chartData = data.map((item, index) => ({
    ...item,
    index,
  }));

  // Calculate tick values for x-axis (show ~5 labels)
  const xAxisTicks = (() => {
    if (!data || data.length < 2) return [];
    const tickCount = Math.min(5, data.length);
    // Exclude last 10% of data points to avoid overlap with y-axis
    const maxIndex = Math.floor(data.length * 0.9);
    const step = Math.max(1, Math.floor(maxIndex / (tickCount - 1)));
    const ticks: number[] = [];
    for (let i = 0; i < maxIndex; i += step) {
      ticks.push(i);
    }
    return ticks;
  })();

  return (
    <ResponsiveContainer height={300} style={style}>
      <AreaChart
        width={500}
        height={420}
        data={chartData}
        margin={chartMargin}
      >
        <defs>
          <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94F27F" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#94F27F" stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="index"
          tickFormatter={index => {
            return data[index] ? formatChartAxisLabel(data[index].time) : '';
          }}
          ticks={xAxisTicks}
          tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 14 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          orientation="right"
          tickFormatter={value => {
            if (typeof value !== 'number' || !isFinite(value))
              return formatYAxis ? formatYAxis(0) : '0';
            return formatYAxis ? formatYAxis(value) : `${formatNumber(value, 1, 0)}`;
          }}
          tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 14 }}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          content={<ChartTooltip data={chartData} formatToolTip={formatToolTip} isPriceChange />}
        />

        <Area
          type="linear"
          dataKey={'value'}
          stroke="#94F27F"
          strokeWidth={1}
          fillOpacity={1}
          fill="url(#colorPv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default Chart;
