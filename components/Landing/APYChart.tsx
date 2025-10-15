import AreaChart from '@/components/AreaChart.web';
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
    <View className="md:flex-1 md:basis-1/2 bg-card rounded-twice overflow-hidden">
      <View className="flex-row items-center gap-1 p-5 md:p-6 pb-0 md:pb-0">
        <Text className="text-lg text-muted-foreground font-semibold">Yield history</Text>
        <TooltipPopover text="Historical yield of last 30 days" />
      </View>

      <View className="h-[200px] items-center justify-center">
        {isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : data && data.length > 0 ? (
          <AreaChart data={data} formatToolTip={formatToolTip} />
        ) : (
          <Text>No data available</Text>
        )}
      </View>
    </View>
  );
};

export default APYChart;
