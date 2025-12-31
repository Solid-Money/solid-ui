import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';

interface BarChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
}

const Chart = ({ data, formatToolTip }: BarChartProps) => {
  if (!data || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map(item => item.value || 0));
  const latestValue = data[data.length - 1]?.value;
  const avgValue = data.reduce((acc, item) => acc + (item.value || 0), 0) / data.length;

  return (
    <View className="flex-1 justify-center items-center gap-4">
      <View className="gap-2 items-center">
        <Text className="text-xs text-muted-foreground">Current APY</Text>
        <Text className="text-3xl font-semibold">
          {formatToolTip ? formatToolTip(latestValue || null) : `${latestValue?.toFixed(2)}%`}
        </Text>
      </View>
      <View className="flex-row gap-6">
        <View className="gap-1 items-center">
          <Text className="text-xs text-muted-foreground">30d Avg</Text>
          <Text className="text-sm font-medium">
            {formatToolTip ? formatToolTip(avgValue) : `${avgValue.toFixed(2)}%`}
          </Text>
        </View>
        <View className="gap-1 items-center">
          <Text className="text-xs text-muted-foreground">30d Max</Text>
          <Text className="text-sm font-medium">
            {formatToolTip ? formatToolTip(maxValue) : `${maxValue.toFixed(2)}%`}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Chart;
