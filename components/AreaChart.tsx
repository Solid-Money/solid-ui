import { ChartPayload } from '@/lib/types';
import { useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import { Defs, LinearGradient, Stop } from 'react-native-svg';
import { VictoryArea, VictoryAxis, VictoryChart } from 'victory-native';

interface AreaChartProps {
  data: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
}

const CHART_HEIGHT = 200;

const Chart = ({ data }: AreaChartProps) => {
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    return data.map((d, index) => ({
      x: index,
      y: d.value,
    }));
  }, [data]);

  if (!chartData) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={{ height: CHART_HEIGHT }}>
      <VictoryChart
        width={screenWidth}
        height={CHART_HEIGHT}
        padding={{ top: 10, bottom: 10, left: 0, right: 0 }}
      >
        <Defs>
          <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#94F27F" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#94F27F" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <VictoryAxis style={{ axis: { stroke: 'transparent' } }} />
        <VictoryAxis dependentAxis style={{ axis: { stroke: 'transparent' } }} />
        <VictoryArea
          data={chartData}
          interpolation="natural"
          style={{
            data: {
              fill: 'url(#areaGradient)',
              stroke: '#94F27F',
              strokeWidth: 2,
            },
          }}
        />
      </VictoryChart>
    </View>
  );
};

export default Chart;
