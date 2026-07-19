import { useMemo, useState } from 'react';
import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

import AmountDropdown from './AmountDropdown';
import { buildProjectionSeries, formatHorizonLabel, SIMULATE_YEARS } from './savingsProjection';
import SimulateChart from './SimulateChart';

const FUTURE_STYLE: TextStyle = {
  fontSize: 30,
  fontWeight: '600',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const EARNED_STYLE: TextStyle = {
  fontSize: 15,
  fontWeight: '600',
  color: '#94F27F',
};

const DEFAULT_PRINCIPAL = 10000;
// Default handle position: the end of the horizon (SIMULATE_YEARS out).
const LAST_INDEX = SIMULATE_YEARS * 12;

interface SimulateSavingsCardProps {
  /** Selected vault's headline APY (percent). */
  apy: number;
}

/**
 * "Simulate your savings" card: pick a principal (100 / 1,000 / 10,000), then
 * drag the chart handle to scrub the projection horizon. Future balance and
 * earned amounts animate (CountUp) as the handle moves.
 */
const SimulateSavingsCard = ({ apy }: SimulateSavingsCardProps) => {
  const [principal, setPrincipal] = useState<number>(DEFAULT_PRINCIPAL);
  const [activeIndex, setActiveIndex] = useState<number>(LAST_INDEX);

  const safeApy = Number.isFinite(apy) && apy > 0 ? apy : 5;
  const series = useMemo(() => buildProjectionSeries(principal, safeApy), [principal, safeApy]);

  const clampedIndex = Math.min(Math.max(activeIndex, 0), series.length - 1);
  const futureBalance = series[clampedIndex]?.value ?? principal;
  const earned = Math.max(futureBalance - principal, 0);
  const horizonLabel = formatHorizonLabel(clampedIndex);

  return (
    <View className="mx-4 gap-4 rounded-twice bg-card p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-white">Simulate your savings</Text>
        <AmountDropdown amount={principal} onSelect={setPrincipal} />
      </View>

      {/* Light divider separating the title/dropdown from the future-balance section. */}
      <View className="h-px bg-white/10" />

      {/*
        Chart fills this region (absolute) and the readouts overlay its top-left:
        text top-left, curve rises from bottom-left to its top-right end. The
        overlay is pointer-events-none so the chart still receives drag gestures.
      */}
      <View className="h-52">
        <SimulateChart
          data={series}
          activeIndex={clampedIndex}
          onActiveIndexChange={setActiveIndex}
        />

        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
          <Text className="text-sm font-medium text-muted-foreground">Future Balance</Text>
          <CountUp
            prefix="$"
            count={futureBalance}
            decimalPlaces={0}
            isTrailingZero={false}
            animateOnMount={false}
            styles={{ wholeText: FUTURE_STYLE }}
          />
          <View className="flex-row items-baseline gap-1">
            <CountUp
              prefix="$"
              count={earned}
              decimalPlaces={0}
              isTrailingZero={false}
              animateOnMount={false}
              styles={{ wholeText: EARNED_STYLE }}
            />
            <Text className="text-sm text-muted-foreground">Earned in {horizonLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default SimulateSavingsCard;
