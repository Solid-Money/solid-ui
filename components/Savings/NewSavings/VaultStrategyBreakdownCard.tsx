import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Image } from 'expo-image';

import DefaultTokenIcon from '@/components/DefaultTokenIcon';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { protocolsImages } from '@/constants/protocols';
import { VAULTS } from '@/constants/vaults';
import { useAPYs, useVaultBreakdown } from '@/hooks/useAnalytics';
import { Minus } from '@/lib/icons/Minus';
import { Plus } from '@/lib/icons/Plus';
import { VaultBreakdown, VaultType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

const CHART_SIZE = 189;
const CHART_STROKE_WIDTH = 9.5;
const CHART_RADIUS = (CHART_SIZE - CHART_STROKE_WIDTH) / 2;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;
const VISIBLE_SEGMENT_GAP_DEGREES = 2;
const ROUND_CAP_SPAN_DEGREES = (CHART_STROKE_WIDTH / CHART_RADIUS) * (180 / Math.PI);
const SEGMENT_GAP_DEGREES = VISIBLE_SEGMENT_GAP_DEGREES + ROUND_CAP_SPAN_DEGREES;
const SELECTED_SEGMENT_COLOR = '#90EA7B';
const UNSELECTED_SEGMENT_COLOR = '#43643C';
const COLLAPSED_STRATEGY_COUNT = 4;

const formatPercent = (value: number) => `${formatNumber(Math.max(value || 0, 0), 2)}%`;

const StrategyIcon = ({ strategy }: { strategy: VaultBreakdown }) => {
  const source = strategy.image ? { uri: strategy.image } : protocolsImages[strategy.type];

  return source ? (
    <Image
      source={source}
      style={{ width: 24, height: 24, borderRadius: 999 }}
      contentFit="cover"
    />
  ) : (
    <DefaultTokenIcon size={24} symbol={(strategy.title ?? strategy.name).charAt(0)} />
  );
};

interface BreakdownDonutProps {
  data: VaultBreakdown[];
  selectedIndex: number;
}

/** The selected strategy stays bright while the other allocation bars recede. */
const BreakdownDonut = ({ data, selectedIndex }: BreakdownDonutProps) => {
  const chartData = data
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.allocation > 0);
  const totalAllocation = chartData.reduce((total, { item }) => total + item.allocation, 0);
  const totalPadding = chartData.length > 1 ? SEGMENT_GAP_DEGREES * chartData.length : 0;
  const availableDegrees = Math.max(360 - totalPadding, 0);

  const segments = chartData.map(({ item, originalIndex }, index) => {
    const segmentDegrees = totalAllocation
      ? (item.allocation / totalAllocation) * availableDegrees
      : 0;
    const segmentLength = (segmentDegrees / 360) * CHART_CIRCUMFERENCE;
    const precedingDegrees = chartData
      .slice(0, index)
      .reduce(
        (total, previous) =>
          total +
          (totalAllocation ? (previous.item.allocation / totalAllocation) * availableDegrees : 0),
        0,
      );
    const offsetDegrees = precedingDegrees + index * SEGMENT_GAP_DEGREES;
    const isSelected = originalIndex === selectedIndex;

    return {
      color: isSelected ? SELECTED_SEGMENT_COLOR : UNSELECTED_SEGMENT_COLOR,
      dashArray: `${segmentLength} ${CHART_CIRCUMFERENCE}`,
      dashOffset: -(offsetDegrees / 360) * CHART_CIRCUMFERENCE,
      isSelected,
      originalIndex,
    };
  });

  const orderedSegments = [
    ...segments.filter(segment => !segment.isSelected),
    ...segments.filter(segment => segment.isSelected),
  ];

  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      <G transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
        {orderedSegments.map(segment => (
          <Circle
            key={`${data[segment.originalIndex].name}-${segment.originalIndex}`}
            cx={CHART_SIZE / 2}
            cy={CHART_SIZE / 2}
            r={CHART_RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth={segment.isSelected ? CHART_STROKE_WIDTH + 3 : CHART_STROKE_WIDTH}
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
            strokeLinecap="round"
            opacity={1}
          />
        ))}
      </G>
    </Svg>
  );
};

interface StrategyRowProps {
  strategy: VaultBreakdown;
  isSelected: boolean;
  onSelect: () => void;
}

const StrategyRow = ({ strategy, isSelected, onSelect }: StrategyRowProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strategy.title ?? strategy.name}
      accessibilityState={{ selected: isSelected }}
      onPress={onSelect}
      className={cn(
        'min-h-[64px] flex-row items-center rounded-[12px] px-[7px] py-[7px]',
        isSelected && 'bg-white/[0.08]',
      )}
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text className="text-[15px] font-medium leading-[18px] text-white" numberOfLines={1}>
          {strategy.title ?? strategy.name}
        </Text>
      </View>
      <Text className="w-[66px] text-[15px] font-medium leading-[18px] text-white">
        {formatPercent(strategy.allocation)}
      </Text>
      <Text className="w-[54px] text-[15px] font-medium leading-[18px] text-white">
        {formatPercent(strategy.positionMaxAPY)}
      </Text>
      <View className="w-[44px] items-end">
        <StrategyIcon strategy={strategy} />
      </View>
    </Pressable>
  );
};

const BreakdownHeader = () => (
  <View className="mb-2.5 flex-row items-center px-[7px]">
    <Text className="min-w-0 flex-1 pr-2 text-[12px] font-normal leading-[15px] text-white/50">
      Position
    </Text>
    <Text className="w-[66px] text-[12px] font-normal leading-[15px] text-white/50">
      Allocation
    </Text>
    <Text className="w-[54px] text-[12px] font-normal leading-[15px] text-white/50">Est. APY</Text>
    <Text className="w-[44px] text-right text-[11px] font-normal leading-[13px] text-white/50">
      Protocol
    </Text>
  </View>
);

const StrategyRowsSkeleton = () => (
  <View>
    {Array.from({ length: COLLAPSED_STRATEGY_COUNT }, (_, index) => (
      <View key={index} className="h-[64px] flex-row items-center px-[7px] py-[7px]">
        <View className="min-w-0 flex-1 pr-2">
          <Skeleton className="h-[18px] rounded bg-white/10" />
        </View>
        <Skeleton className="mr-5 h-[18px] w-[52px] rounded bg-white/10" />
        <Skeleton className="mr-4 h-[18px] w-[45px] rounded bg-white/10" />
        <Skeleton className="size-6 rounded-full bg-white/10" />
      </View>
    ))}
  </View>
);

interface VaultStrategyBreakdownCardProps {
  vaultType: VaultType;
}

/** Figma 24766:5183 — current APY and the strategies composing the selected vault. */
const VaultStrategyBreakdownCard = ({ vaultType }: VaultStrategyBreakdownCardProps) => {
  const [selectedStrategyIndex, setSelectedStrategyIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const vault = VAULTS.find(item => item.type === vaultType) ?? VAULTS[0];
  const { data: apys, isLoading: isApyLoading } = useAPYs(vaultType);
  const { data: strategies = [], isLoading: isBreakdownLoading } = useVaultBreakdown(
    vault.name.toLowerCase(),
  );
  const sevenDayApy = Math.max(apys?.sevenDay ?? 0, 0);
  const selectedStrategy = strategies[selectedStrategyIndex] ?? strategies[0];
  const visibleStrategies = isExpanded ? strategies : strategies.slice(0, COLLAPSED_STRATEGY_COUNT);
  const hasHiddenStrategies = strategies.length > COLLAPSED_STRATEGY_COUNT;

  useEffect(() => {
    setSelectedStrategyIndex(0);
    setIsExpanded(false);
  }, [vaultType]);

  useEffect(() => {
    if (selectedStrategyIndex >= strategies.length) {
      setSelectedStrategyIndex(0);
    }
  }, [selectedStrategyIndex, strategies.length]);

  const handleToggleExpanded = () => {
    if (isExpanded && selectedStrategyIndex >= COLLAPSED_STRATEGY_COUNT) {
      setSelectedStrategyIndex(0);
    }
    setIsExpanded(expanded => !expanded);
  };

  return (
    <View
      testID="vault-strategy-breakdown-card"
      className="mx-4 overflow-hidden rounded-[20px] bg-[#1C1C1C] px-5 pb-[21px] pt-[38px]"
    >
      <View className="items-center">
        <View className="relative size-[189px] items-center justify-center">
          {isBreakdownLoading ? (
            <Skeleton className="size-[189px] rounded-full bg-white/10" />
          ) : (
            <BreakdownDonut data={strategies} selectedIndex={selectedStrategyIndex} />
          )}

          <View className="absolute items-center">
            <Text className="text-[12px] font-normal leading-[15px] text-white/50">
              {selectedStrategy ? 'Allocation' : '7D APY'}
            </Text>
            {isBreakdownLoading || (!selectedStrategy && isApyLoading) ? (
              <Skeleton className="mt-[7px] h-10 w-[110px] rounded-md bg-white/10" />
            ) : (
              <>
                <Text className="mt-0.5 text-[32px] font-semibold leading-[35px] text-white">
                  {selectedStrategy
                    ? formatPercent(selectedStrategy.allocation)
                    : formatNumber(sevenDayApy, 1) + '%'}
                </Text>
                {selectedStrategy && (
                  <>
                    <Text
                      className="mt-0.5 max-w-[132px] text-[12px] font-normal leading-[15px] text-white/80"
                      numberOfLines={1}
                    >
                      {selectedStrategy.title ?? selectedStrategy.name}
                    </Text>
                    <Text className="text-[11px] font-normal leading-[14px] text-white/50">
                      {formatPercent(selectedStrategy.positionMaxAPY)} APY
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </View>

      <View className="mt-[46px]">
        {isBreakdownLoading ? (
          <>
            <BreakdownHeader />
            <StrategyRowsSkeleton />
          </>
        ) : strategies.length > 0 ? (
          <>
            <BreakdownHeader />
            {visibleStrategies.map((strategy, index) => (
              <StrategyRow
                key={`${strategy.name}-${index}`}
                strategy={strategy}
                isSelected={selectedStrategyIndex === index}
                onSelect={() => setSelectedStrategyIndex(index)}
              />
            ))}
            {hasHiddenStrategies && (
              <Pressable
                testID="vault-strategy-breakdown-toggle"
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? 'Show fewer strategies' : 'View full breakdown'}
                accessibilityState={{ expanded: isExpanded }}
                onPress={handleToggleExpanded}
                className="mt-[18px] h-8 flex-row items-center justify-center gap-1.5"
              >
                {isExpanded ? (
                  <Minus color="rgba(255, 255, 255, 0.7)" size={16} strokeWidth={2} />
                ) : (
                  <Plus color="rgba(255, 255, 255, 0.7)" size={16} strokeWidth={2} />
                )}
                <Text className="text-[15px] font-medium leading-[18px] text-white/70">
                  {isExpanded ? 'Show less' : 'View full breakdown'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <View className="h-[200px] items-center justify-center">
            <Text className="text-[16px] text-white/50">No strategy data available</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default VaultStrategyBreakdownCard;
