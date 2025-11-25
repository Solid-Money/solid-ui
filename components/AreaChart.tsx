import { ChartPayload } from '@/lib/types';
import { useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface AreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
}

const CHART_HEIGHT = 200;

const Chart = ({ data }: AreaChartProps) => {
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    return {
      labels: [],
      datasets: [
        {
          data: data.map(d => d.value),
          color: () => '#94F27F',
          strokeWidth: 2,
        },
      ],
    };
  }, [data]);

  if (!chartData) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={{ height: CHART_HEIGHT }}>
      <LineChart
        data={chartData}
        width={screenWidth}
        height={CHART_HEIGHT}
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels={false}
        withHorizontalLabels={false}
        withVerticalLines={false}
        withHorizontalLines={false}
        chartConfig={{
          backgroundGradientFrom: 'transparent',
          backgroundGradientFromOpacity: 0,
          backgroundGradientTo: 'transparent',
          backgroundGradientToOpacity: 0,
          color: () => '#94F27F',
          fillShadowGradientFrom: '#94F27F',
          fillShadowGradientFromOpacity: 0.15,
          fillShadowGradientTo: '#94F27F',
          fillShadowGradientToOpacity: 0,
          strokeWidth: 2,
          propsForBackgroundLines: {
            strokeWidth: 0,
          },
        }}
        bezier
        style={{
          paddingRight: 0,
          paddingLeft: 0,
        }}
      />
    </View>
  );
};

export default Chart;
