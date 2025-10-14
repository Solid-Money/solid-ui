import ChartTooltip from '@/components/Coin/ChartTooltip';
import { CoinPayload } from '@/lib/types';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

interface CoinChartProps {
  data: CoinPayload[];
}

const CoinChart = ({ data }: CoinChartProps) => {
  return (
    <ResponsiveContainer height={200}>
      <AreaChart
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
          <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94F27F" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#94F27F" stopOpacity={0} />
          </linearGradient>
        </defs>

        <Tooltip content={<ChartTooltip data={data} />} />

        <Area
          type="linear"
          dataKey={'value'}
          stroke="#94F27F"
          fillOpacity={1}
          fill="url(#colorPv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default CoinChart;
