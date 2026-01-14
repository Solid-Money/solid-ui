import { Bar, BarChart, ResponsiveContainer, Tooltip } from 'recharts';

import ChartTooltip from '@/components/ChartTooltip';
import { ChartPayload } from '@/lib/types';

interface BarChartProps {
  data: ChartPayload[];
  height?: number;
  formatToolTip?: (value: number | null) => string;
}

const Chart = ({ data, height = 150, formatToolTip }: BarChartProps) => {
  return (
    <ResponsiveContainer height={height}>
      <BarChart
        width={500}
        height={420}
        data={data}
        margin={{
          top: 10,
          right: 0,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="100%" stopColor="#94F27F" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#94F27F" stopOpacity={0.3} />
          </linearGradient>
        </defs>

        <Tooltip content={<ChartTooltip data={data} formatToolTip={formatToolTip} />} />

        <Bar dataKey={'value'} fill="url(#colorBar)" barSize={7} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;
