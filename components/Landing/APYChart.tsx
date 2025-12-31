import BarChart from '@/components/BarChart';
import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { useHistoricalAPY } from '@/hooks/useAnalytics';
import { formatNumber } from '@/lib/utils/utils';
import { ActivityIndicator, View } from 'react-native';

const APYChart = () => {
  const { data, isLoading } = useHistoricalAPY();

  const formatToolTip = (value: number | null) => {
    if (!value) {
      return `0.00%`;
    }
    return `${formatNumber(value, 2)}%`;
  };

  return (
    <View className="overflow-hidden rounded-twice bg-card p-5 md:flex-1 md:basis-1/2 md:p-8">
      <View className="flex-row items-center gap-1">
        <Text className="text-lg font-semibold text-muted-foreground">Yield history</Text>
        <TooltipPopover text="Historical yield of last 30 days" />
      </View>

      <View className="h-[150px] items-center justify-center">
        {isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : data && data.length > 0 ? (
          <BarChart data={data} formatToolTip={formatToolTip} />
        ) : (
          <Text className="text-base">No data available</Text>
        )}
      </View>
    </View>
  );
};

export default APYChart;
