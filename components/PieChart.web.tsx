import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { VaultBreakdown } from '@/lib/types';

interface PieChartProps {
  data: VaultBreakdown[];
  selectedBreakdown: number;
}

const colors = ['#8D58EA', '#CD77DE', '#6436AD'];

const Chart = ({ data, selectedBreakdown }: PieChartProps) => {
  const chartData = data.map((item, index) => ({
    name: item.name,
    value: item.allocation,
    color: colors[index % colors.length],
  }));

  return (
    <ResponsiveContainer width={'50%'} height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={150}
          outerRadius={170}
          paddingAngle={2}
          cornerRadius={16}
          dataKey="value"
          labelLine={false}
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              opacity={selectedBreakdown === -1 || selectedBreakdown === index ? 1 : 0.5}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default Chart;
