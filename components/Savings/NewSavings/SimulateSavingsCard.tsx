import { useMemo, useState } from 'react';
import { TextStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';
import useDebounce from '@/hooks/useDebounce';

import AmountDropdown from './AmountDropdown';
import { buildProjectionSeries, formatHorizonLabel } from './savingsProjection';
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
// Default handle position: 9 years out (series is sampled monthly, so index = months).
const DEFAULT_INDEX = 9 * 12;
// How long the handle must settle before the readouts roll — stops the CountUps
// from re-triggering (twitching) on every drag frame.
const READOUT_DEBOUNCE_MS = 120;

const SimulationIcon = () => (
  <View className="h-6 w-6 items-center justify-center">
    <Svg width={17.3355} height={20.1171} viewBox="0 0 17.3355 20.1171" fill="none">
      <Path
        d="M10.9323 0.750409H5.57485C5.40779 0.750409 5.32425 0.750409 5.25051 0.775848C5.18529 0.798337 5.12589 0.83505 5.07661 0.883323C5.02088 0.937907 4.98352 1.01262 4.9088 1.16205L0.999303 8.98103C0.820881 9.33791 0.73167 9.51635 0.753098 9.66137C0.771808 9.78796 0.841862 9.90134 0.946767 9.97469C1.06691 10.0587 1.26639 10.0587 1.66535 10.0587H7.44169L4.64921 19.3671L15.9989 7.59698C16.3819 7.19988 16.5733 7.00133 16.5845 6.83143C16.5942 6.68397 16.5333 6.54065 16.4204 6.44528C16.2904 6.33541 16.0146 6.33541 15.4629 6.33541H8.83794L10.9323 0.750409Z"
        stroke="#94F27F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

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
  const [activeIndex, setActiveIndex] = useState<number>(DEFAULT_INDEX);

  const safeApy = Number.isFinite(apy) && apy > 0 ? apy : 5;
  const series = useMemo(() => buildProjectionSeries(principal, safeApy), [principal, safeApy]);

  const clampedIndex = Math.min(Math.max(activeIndex, 0), series.length - 1);

  // The chart handle tracks the finger live (clampedIndex); the numeric readouts
  // follow a debounced index so their roll animation fires once the drag settles
  // instead of restarting on every frame.
  const debouncedIndex = useDebounce(clampedIndex, READOUT_DEBOUNCE_MS);
  const readoutIndex = Math.min(Math.max(debouncedIndex, 0), series.length - 1);
  const futureBalance = series[readoutIndex]?.value ?? principal;
  const earned = Math.max(futureBalance - principal, 0);
  const horizonLabel = formatHorizonLabel(readoutIndex);

  return (
    <View className="mx-4 gap-5 rounded-twice bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <SimulationIcon />
          <Text
            className="text-base text-white"
            style={{ fontFamily: 'MonaSans_500Medium', lineHeight: 20 }}
          >
            Simulate your savings
          </Text>
        </View>
        <AmountDropdown amount={principal} onSelect={setPrincipal} />
      </View>

      {/* Light divider separating the title/dropdown from the future-balance section. */}
      <View className="-mx-5 h-px bg-white/10" />

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
