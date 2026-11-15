import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import CategoryIcon from '@/components/Insights/CategoryIcon';
import SegmentedArc from '@/components/Insights/SegmentedArc';
import SpendDeltaLine from '@/components/Insights/SpendDeltaLine';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useSpendingInsights } from '@/hooks/useSpendingInsights';
import {
  formatInsightUsd,
  getLatestSpendMonthKey,
  getMonthContext,
  getMonthName,
} from '@/lib/utils/spendingInsights';

const GAUGE_SIZE = 240;
const GAUGE_STROKE_WIDTH = 16;
const CARD_CLASS_NAME = 'mt-4 overflow-hidden rounded-[20px] bg-[#1C1C1C] py-[18px]';
const SKELETON_STYLE = { backgroundColor: '#343434' };

function MonthlySummarySkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading spending summary"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      className={CARD_CLASS_NAME}
    >
      <View className="h-6 flex-row items-center justify-between px-5">
        <Skeleton className="h-4 w-32" style={SKELETON_STYLE} />
        <Skeleton className="h-3 w-16" style={SKELETON_STYLE} />
      </View>

      <View className="mt-3 items-center">
        <View style={{ width: GAUGE_SIZE }}>
          <SegmentedArc
            variant="half"
            size={GAUGE_SIZE}
            strokeWidth={GAUGE_STROKE_WIDTH}
            segments={[]}
            trackColor={SKELETON_STYLE.backgroundColor}
          />
          <View className="absolute inset-x-0 top-11 items-center">
            <View className="h-9 justify-center">
              <Skeleton className="h-6 w-24" style={SKELETON_STYLE} />
            </View>
            <Skeleton className="h-3 w-28" style={SKELETON_STYLE} />
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row gap-2 px-5">
        <Skeleton className="h-[34px] w-40 shrink-0 rounded-full" style={SKELETON_STYLE} />
        <Skeleton className="h-[34px] w-36 shrink-0 rounded-full" style={SKELETON_STYLE} />
      </View>
    </View>
  );
}

/**
 * "Spent in September" above the Activity feed: the month's total and change
 * inside a category gauge, the categories as chips, and the way into Insights.
 *
 * Shows the newest month with spend — this one, or last month in the first
 * days of a new one — and renders nothing for a card with no purchases.
 */
export default function MonthlySummaryCard() {
  const insights = useSpendingInsights();
  if (insights.isLoading) return <MonthlySummarySkeleton />;

  const monthKey = getLatestSpendMonthKey(insights);
  const { month, previous, change, isFirstMonth } = getMonthContext(
    insights,
    monthKey ?? insights.currentMonthKey,
  );

  if (!monthKey || !month || month.total <= 0) return null;

  const openInsights = () => router.push(path.ACTIVITY_INSIGHTS);

  return (
    <Pressable
      onPress={openInsights}
      accessibilityRole="button"
      accessibilityLabel={`Spent ${formatInsightUsd(month.total)} in ${getMonthName(month.key)}. Open insights`}
      className={CARD_CLASS_NAME}
    >
      <View className="flex-row items-center justify-between px-5">
        <Text className="text-base font-medium text-white/50">
          Spent in {getMonthName(month.key)}
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-sm font-medium text-white/90">Insights</Text>
          <ChevronRight size={16} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <View className="mt-3 items-center">
        <View style={{ width: GAUGE_SIZE }}>
          <SegmentedArc
            variant="half"
            size={GAUGE_SIZE}
            strokeWidth={GAUGE_STROKE_WIDTH}
            gap={5}
            segments={month.categories.map(category => ({
              key: category.key,
              value: category.amount,
              color: category.color,
            }))}
          />
          <View className="absolute inset-x-0 top-11 items-center">
            <Text className="text-[28px] font-semibold leading-9">
              {formatInsightUsd(month.total)}
            </Text>
            <SpendDeltaLine
              size="sm"
              align="center"
              change={change}
              previousMonthName={previous ? getMonthName(previous.key) : undefined}
              isFirstMonth={isFirstMonth}
              cashbackUsd={month.cashbackUsd}
            />
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-4"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {month.categories.map(category => (
          <View
            key={category.key}
            className="flex-row items-center gap-2 rounded-full bg-[#262626] py-[5px] pl-[5px] pr-3"
          >
            <CategoryIcon category={category.key} size={24} />
            <Text className="text-[13px] font-medium text-white/90">{category.label}</Text>
            <Text className="text-[13px] text-white/50">{category.percent}%</Text>
          </View>
        ))}
      </ScrollView>
    </Pressable>
  );
}
