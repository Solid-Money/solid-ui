import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { VaultBreakdown } from '@/lib/types';
import { formatNumber } from '@/lib/utils/utils';

interface VaultBreakdownChartProps {
  data: VaultBreakdown[];
  selectedBreakdown: number;
}

const colors = ['#8D58EA', '#CD77DE', '#6436AD'];

const VaultBreakdownChart = ({ data, selectedBreakdown }: VaultBreakdownChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  const totalAPY = data.reduce((acc, item) => acc + item.effectivePositionAPY, 0);

  // Donut chart dimensions
  const size = 280;
  const strokeWidth = 40;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const paddingAngle = 2; // Padding in degrees between segments (matching web paddingAngle={2})

  // Calculate total with padding
  const totalPadding = paddingAngle * data.length;
  const availableAngle = 360 - totalPadding;

  // Calculate segments
  let currentAngle = 0;
  const segments = data.map((item, index) => {
    const segmentAngle = (item.allocation / 100) * availableAngle;
    const segmentLength = (segmentAngle / 360) * circumference;
    const startAngle = currentAngle + index * paddingAngle;
    const offset = (startAngle / 360) * circumference;

    currentAngle += segmentAngle;

    return {
      color: colors[index % colors.length],
      strokeDasharray: `${segmentLength} ${circumference}`,
      strokeDashoffset: -offset,
      opacity: selectedBreakdown === -1 || selectedBreakdown === index ? 1 : 0.5,
    };
  });

  return (
    <View className="flex-1 items-center justify-center py-8 md:grow-0 md:basis-1/3 md:p-6">
      <View className="relative items-center justify-center" style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {segments.map((segment, index) => (
              <Circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                fill="none"
                strokeLinecap="butt"
                opacity={segment.opacity}
              />
            ))}
          </G>
        </Svg>

        <View className="absolute items-center gap-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted-foreground">Total Effective APY</Text>
            <TooltipPopover text="Sum of all Effective Position APY" />
          </View>
          <Text className="text-4xl font-semibold">{formatNumber(totalAPY, 2)}%</Text>
        </View>
      </View>
    </View>
  );
};

export default VaultBreakdownChart;
