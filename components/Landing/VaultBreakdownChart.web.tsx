import { useState } from 'react';
import { View } from 'react-native';
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts';

import TooltipPopover from '@/components/Tooltip';
import { VaultBreakdown } from '@/lib/types';
import { formatNumber } from '@/lib/utils/utils';

interface VaultBreakdownChartProps {
  data: VaultBreakdown[];
  selectedBreakdown: number;
}

interface CustomLabelProps {
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  value1: string;
  value2: string;
}

const colors = ['#8D58EA', '#CD77DE', '#6436AD'];

function CustomLabel({ viewBox, value1, value2 }: CustomLabelProps) {
  if (!viewBox) return null;

  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height / 2;

  return (
    <>
      <text
        x={cx}
        y={cy - 15}
        fill="rgba(255, 255, 255, 0.5)"
        className="recharts-text recharts-label"
        textAnchor="middle"
        dominantBaseline="central"
      >
        <tspan alignmentBaseline="middle" fontSize="18px">
          {value1}
        </tspan>
      </text>
      <foreignObject x={cx + 80} y={cy - 22} width="20" height="20" style={{ overflow: 'visible' }}>
        <TooltipPopover text="Total Effective APY" />
      </foreignObject>
      <text
        x={cx}
        y={cy + 15}
        fill="hsla(0, 0.00%, 100.00%)"
        className="recharts-text recharts-label"
        textAnchor="middle"
        dominantBaseline="central"
      >
        <tspan fontSize="40px" fontWeight="semibold">
          {value2}
        </tspan>
      </text>
    </>
  );
}

const VaultBreakdownChart = ({ data, selectedBreakdown }: VaultBreakdownChartProps) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const chartData = data.map((item, index) => ({
    name: item.title ?? item.name,
    value: item.allocation,
    color: colors[index % colors.length],
  }));
  const totalAPY = data.reduce((acc, item) => acc + item.effectivePositionAPY, 0);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const minDimension = Math.min(dimensions.width, dimensions.height);
  const innerRadiusRatio = 0.45;
  const outerRadiusRatio = 0.5;
  const innerRadius = minDimension * innerRadiusRatio;
  const outerRadius = minDimension * outerRadiusRatio;

  return (
    <View
      className="flex-1 justify-end md:grow-0 md:basis-1/3 md:items-center md:justify-center"
      onLayout={handleLayout}
    >
      <View style={{ width: minDimension || undefined, height: minDimension || undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
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
              <Label
                width={100}
                position="center"
                content={
                  <CustomLabel
                    value1={'Total Effective APY'}
                    value2={`${formatNumber(totalAPY, 2)}%`}
                  />
                }
              ></Label>
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </View>
    </View>
  );
};

export default VaultBreakdownChart;
