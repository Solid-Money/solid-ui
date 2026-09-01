import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import BarChart from '@/components/BarChart';
import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAPYs, useHistoricalAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { APYs, VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

import SelectSheet from './SelectSheet';

const CHART_HEIGHT = 76;
const MOBILE_VISIBLE_BARS = 24;
const DESKTOP_VISIBLE_BARS = 38;

type ApyPeriod = {
  days: '7' | '15' | '30';
  label: '7D' | '15D' | '30D';
  title: string;
  valueKey: keyof Pick<APYs, 'sevenDay' | 'fifteenDay' | 'thirtyDay'>;
};

const APY_PERIODS: ApyPeriod[] = [
  { days: '7', label: '7D', title: '7 Day APY', valueKey: 'sevenDay' },
  { days: '15', label: '15D', title: '15 Day APY', valueKey: 'fifteenDay' },
  { days: '30', label: '30D', title: '30 Day APY', valueKey: 'thirtyDay' },
];

const resampleHistory = (
  history: { time: string | number; value: number }[],
  visibleBarCount: number,
) => {
  if (history.length <= 1) return history;

  return Array.from({ length: visibleBarCount }, (_, index) => {
    const position = (index * (history.length - 1)) / (visibleBarCount - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.ceil(position);
    const progress = position - leftIndex;
    const left = history[leftIndex];
    const right = history[rightIndex];
    const leftTime = typeof left.time === 'number' ? left.time : new Date(left.time).getTime();
    const rightTime = typeof right.time === 'number' ? right.time : new Date(right.time).getTime();

    return {
      time:
        Number.isFinite(leftTime) && Number.isFinite(rightTime)
          ? Math.round(leftTime + (rightTime - leftTime) * progress)
          : left.time,
      value: left.value + (right.value - left.value) * progress,
    };
  });
};

type PeriodPillProps = {
  period: ApyPeriod;
} & React.ComponentProps<typeof Pressable>;

const PeriodPill = React.forwardRef<View, PeriodPillProps>(({ period, ...props }, ref) => (
  <Pressable
    ref={ref}
    accessibilityRole="button"
    accessibilityLabel={`Change APY period. Current period: ${period.label}`}
    className="h-[22px] min-w-[55px] flex-row items-center justify-center gap-[5px] rounded-full bg-[#2D2D2D] px-[10px] transition-all active:scale-95 active:opacity-80"
    {...props}
  >
    <Text className="text-[14px] font-normal leading-[14px] text-white/70">{period.label}</Text>
    <ChevronDown size={13} strokeWidth={1.5} color="rgba(255,255,255,0.7)" />
  </Pressable>
));
PeriodPill.displayName = 'PeriodPill';

const PeriodDropdown = ({
  period,
  onSelect,
}: {
  period: ApyPeriod;
  onSelect: (period: ApyPeriod) => void;
}) => (
  <SelectSheet trigger={<PeriodPill period={period} />} title="APY period">
    {dismiss => (
      <View className="flex-row gap-2 px-5 py-2">
        {APY_PERIODS.map(option => {
          const active = option.days === period.days;

          return (
            <Pressable
              key={option.days}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onSelect(option);
                dismiss();
              }}
              className={cn(
                'flex-1 items-center rounded-full py-3 transition-all active:scale-95',
                active ? 'bg-white' : 'bg-[#262626]',
              )}
            >
              <Text className={cn('text-base font-semibold', active ? 'text-black' : 'text-white')}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    )}
  </SelectSheet>
);

interface VaultApyHistoryCardProps {
  vaultType: VaultType;
}

/** Figma 24766:4859 — compact vault APY summary using the legacy historical APY chart. */
const VaultApyHistoryCard = ({ vaultType }: VaultApyHistoryCardProps) => {
  const { isDesktop } = useDimension();
  const [period, setPeriod] = useState(APY_PERIODS[0]);
  const { data: apys, isLoading: isApyLoading } = useAPYs(vaultType);
  const { data: history = [], isLoading: isHistoryLoading } = useHistoricalAPY(
    period.days,
    vaultType,
  );

  const chartData = useMemo(() => {
    const validHistory = history.filter(point => Number.isFinite(point.value) && point.value >= 0);

    return resampleHistory(validHistory, isDesktop ? DESKTOP_VISIBLE_BARS : MOBILE_VISIBLE_BARS);
  }, [history, isDesktop]);
  const currentApy = Math.max(apys?.[period.valueKey] ?? 0, 0);

  return (
    <View className="relative mx-4 h-[199px] overflow-hidden rounded-[20px] bg-[#1C1C1C]">
      <View className="absolute left-5 right-[15px] top-5 flex-row items-start justify-between">
        <View className="h-[22px] flex-row items-center gap-[7px]">
          <Text className="text-[16px] font-medium leading-[16px] text-white/50">
            {period.title}
          </Text>
          <TooltipPopover
            text="The vault's average annual percentage yield over the selected period."
            analyticsContext="vault_apy_history"
          />
        </View>

        <PeriodDropdown period={period} onSelect={setPeriod} />
      </View>

      {isApyLoading ? (
        <Skeleton className="absolute left-5 top-[50px] h-[28px] w-[82px] bg-white/10" />
      ) : (
        <Text className="absolute left-5 top-[50px] text-[26px] font-semibold leading-[28px] text-white">
          {currentApy.toFixed(2)}%
        </Text>
      )}

      <View className="absolute bottom-4 left-[15px] right-[15px] h-[76px] overflow-visible">
        {isHistoryLoading ? (
          <Skeleton className="h-[76px] w-full bg-white/10" />
        ) : chartData.length > 0 ? (
          <BarChart
            key={period.days}
            data={chartData}
            height={CHART_HEIGHT}
            compact
            formatToolTip={value => `${Math.max(value ?? 0, 0).toFixed(2)}%`}
          />
        ) : (
          <View className="h-[76px] items-center justify-center">
            <Text className="text-[14px] text-white/40">No APY history available</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default VaultApyHistoryCard;
