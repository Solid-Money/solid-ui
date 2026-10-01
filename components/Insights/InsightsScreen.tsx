import { ReactNode, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import CategoryIcon from '@/components/Insights/CategoryIcon';
import SegmentedArc from '@/components/Insights/SegmentedArc';
import SpendDeltaLine from '@/components/Insights/SpendDeltaLine';
import { DailyBars, MonthBars } from '@/components/Insights/SpendingBars';
import PageLayout from '@/components/PageLayout';
import SubscriptionBrandBadge from '@/components/Rewards/NewRewards/SubscriptionBrandBadge';
import {
  SUBSCRIPTION_CATEGORIES,
  subscriptionCategoryLabel,
} from '@/components/Rewards/NewRewards/subscriptionBrands';
import { BackButton } from '@/components/ui/back-button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useSpendingInsights } from '@/hooks/useSpendingInsights';
import { cn } from '@/lib/utils';
import {
  formatInsightUsd,
  getLatestSpendMonthKey,
  getMonthContext,
  getMonthKey as getMonthKeyOf,
  getMonthName,
  getShortMonthName,
  getVisibleMonths,
  MonthSummary,
  shiftMonthKey,
  SPENDING_CATEGORIES,
  SpendingCategoryKey,
} from '@/lib/utils/spendingInsights';

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <View className={cn('overflow-hidden rounded-[20px] bg-[#1C1C1C]', className)}>{children}</View>
);

const Divider = () => <View className="h-px bg-[#2A2A2A]" />;

function Header() {
  return (
    <View className="relative flex-row items-center justify-center">
      <View className="absolute left-0">
        <BackButton fallbackHref={path.ACTIVITY as string} />
      </View>
      <Text className="text-lg font-semibold text-white">Insights</Text>
    </View>
  );
}

function CategoriesCard({
  month,
  highlightKey,
}: {
  month: MonthSummary;
  /** The category of the purchase that opened this screen, lifted off the list. */
  highlightKey?: SpendingCategoryKey;
}) {
  const monthName = getMonthName(month.key);
  if (month.total <= 0) {
    return (
      <Card className="px-5 py-6">
        <Text className="text-center text-sm text-white/60">No card purchases in {monthName}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text className="px-5 py-4 text-base font-medium text-white/70">{monthName} by category</Text>
      <Divider />
      <View className="items-center pb-2 pt-6">
        <View style={{ width: 166, height: 166 }}>
          <SegmentedArc
            variant="full"
            size={166}
            strokeWidth={14}
            gap={5}
            segments={month.categories.map(category => ({
              key: category.key,
              value: category.amount,
              color: category.color,
            }))}
          />
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-xl font-semibold">{formatInsightUsd(month.total)}</Text>
            <Text className="text-[13px] text-white/50">
              {month.purchaseCount} purchase{month.purchaseCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>
      <View className="pb-2.5 pt-2">
        {month.categories.map(category => (
          <View
            key={category.key}
            className={cn(
              'flex-row items-center gap-3 px-5 py-[7px]',
              category.key === highlightKey && 'bg-white/[0.06]',
            )}
          >
            <CategoryIcon category={category.key} />
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold">{category.label}</Text>
              <Text className="text-sm text-white/70">
                {category.count} purchase{category.count === 1 ? '' : 's'}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-base font-semibold">{formatInsightUsd(category.amount)}</Text>
              <Text className="text-sm text-white/70">{category.percent}%</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const PROMPT_BRANDS = ['OpenAI', 'Netflix', 'Spotify'];

const findBrand = (name?: string) =>
  name
    ? SUBSCRIPTION_CATEGORIES.flatMap(category => category.brands).find(
        brand => brand.name === name,
      )
    : undefined;

const formatChargeDate = (ms: number) =>
  `${getShortMonthName(getMonthKeyOf(ms))} ${new Date(ms).getDate()}`;

/**
 * Every subscription charged this month — recognised by service name, merchant
 * code, or the cashback the backend paid on it — with that cashback where there
 * is some. Shown even when there is none yet, so people know it is tracked.
 */
function SubscriptionsCard({
  month,
  categoryLimit,
  discountRate,
  isCurrentMonth,
}: {
  month: MonthSummary;
  categoryLimit: number;
  discountRate: number;
  isCurrentMonth: boolean;
}) {
  const total = month.subscriptions.reduce((sum, item) => sum + item.amountUsd, 0);
  const monthName = getMonthName(month.key);

  return (
    <Card>
      <View className="flex-row items-center justify-between px-5 py-4">
        <Text className="text-base font-medium text-white/70">Subscriptions</Text>
        {total > 0 && <Text className="text-sm text-white/50">{formatInsightUsd(total)}</Text>}
      </View>
      <Divider />

      {month.subscriptions.length === 0 ? (
        <View className="items-center px-6 pb-6 pt-5">
          <View className="flex-row">
            {PROMPT_BRANDS.map((name, index) => {
              const brand = findBrand(name);
              return brand ? (
                <SubscriptionBrandBadge
                  key={name}
                  brand={brand}
                  size={32}
                  overlap={index === 0 ? undefined : -8}
                  ring
                />
              ) : null;
            })}
          </View>
          <Text className="mt-3 text-base font-semibold">No subscriptions in {monthName}</Text>
          {/* The invitation only makes sense for a month still under way. */}
          {isCurrentMonth && (
            <Text className="mt-1.5 text-center text-sm text-white/60">
              Pay for Netflix, Spotify, ChatGPT and more with your Solid card and we&apos;ll track
              them here
              {discountRate > 0 ? `, with ${discountRate}% cashback on your plan.` : '.'}
            </Text>
          )}
        </View>
      ) : (
        <View className="py-1.5">
          {month.subscriptions.map(item => {
            const brand = findBrand(item.brand);
            const categoryLabel = subscriptionCategoryLabel(item.category);
            const charged =
              item.charges > 1
                ? `${item.charges} charges`
                : `Charged ${formatChargeDate(item.lastChargedAt)}`;
            return (
              <View key={item.key} className="flex-row items-center gap-3 px-5 py-[7px]">
                {brand ? (
                  <View className="h-[37px] w-[37px] items-center justify-center">
                    <SubscriptionBrandBadge brand={brand} size={30} />
                  </View>
                ) : (
                  <CategoryIcon category="subscriptions" />
                )}
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold" numberOfLines={1}>
                    {item.merchant}
                  </Text>
                  <Text className="text-sm text-white/70" numberOfLines={1}>
                    {categoryLabel ? `${categoryLabel} · ${charged}` : charged}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-semibold">
                    {formatInsightUsd(item.amountUsd)}
                  </Text>
                  {item.cashbackUsd > 0 && (
                    <Text className="text-sm text-brand">
                      +{formatInsightUsd(item.cashbackUsd)} back
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Only this month: the limit is the tier's today, and a past month was
          earned under whatever tier the user held then. */}
      {isCurrentMonth && categoryLimit > 0 && month.subscriptionCategoriesUsed.length > 0 && (
        <>
          <Divider />
          <Text className="px-5 py-4 text-[13px] text-white/60">
            {Math.min(month.subscriptionCategoriesUsed.length, categoryLimit)} of {categoryLimit}{' '}
            subscription categories used this month
          </Text>
        </>
      )}
    </Card>
  );
}

function LoadingState() {
  return (
    <View className="gap-3">
      <Skeleton className="h-[280px] w-full rounded-[20px] bg-card" />
      <Skeleton className="h-[420px] w-full rounded-[20px] bg-card" />
    </View>
  );
}

/**
 * Where the card money went, by month and category (Figma 27297:1274, with the
 * first-month state 27322:1298). Never shown before the first purchase.
 *
 * The month chart is the month picker: tapping a bar switches the whole screen.
 * With a single month there is nothing to pick, so it shows that month by day.
 */
export default function InsightsScreen() {
  // Set when a transaction's Category row opened this screen: start on that
  // purchase's month and point at its category.
  const params = useLocalSearchParams<{ month?: string; category?: string }>();
  const highlightKey =
    params.category && params.category in SPENDING_CATEGORIES
      ? (params.category as SpendingCategoryKey)
      : undefined;
  const insights = useSpendingInsights();
  const visibleMonths = useMemo(() => getVisibleMonths(insights), [insights]);
  const defaultKey = getLatestSpendMonthKey(insights) ?? insights.currentMonthKey;
  // Null until the user taps a month: until then the screen follows the newest
  // month with spend, which is only known once the history has loaded.
  const [pickedKey, setPickedKey] = useState<string | null>(params.month ?? null);
  const selectedKey =
    pickedKey && visibleMonths.some(month => month.key === pickedKey) ? pickedKey : defaultKey;

  const { month, previous, change, isFirstMonth } = getMonthContext(insights, selectedKey);
  const isSingleMonth = visibleMonths.length <= 1;
  const isCurrentMonth = selectedKey === insights.currentMonthKey;
  const today = new Date();

  let body: ReactNode;
  if (insights.isLoading) {
    body = <LoadingState />;
  } else if (!insights.hasAnyPurchase || !month) {
    // Insights only exist once there is a purchase: the Activity card that
    // opens this screen is hidden until then, so anyone landing here without
    // one (a stale deep link) goes back to the feed.
    return <Redirect href={path.ACTIVITY} />;
  } else {
    body = (
      <>
        <Card className="px-5 pb-4 pt-5">
          <Text className="text-base font-medium text-white/50">
            Spent in {getMonthName(month.key)}
          </Text>
          <Text className="mt-2 text-[26px] font-semibold">{formatInsightUsd(month.total)}</Text>
          <View className="mt-1.5">
            <SpendDeltaLine
              change={change}
              previousMonthName={previous ? getMonthName(previous.key) : undefined}
              isFirstMonth={isFirstMonth}
              cashbackUsd={month.cashbackUsd}
            />
          </View>
          <View className="mt-5">
            {isSingleMonth ? (
              <DailyBars
                values={month.daily}
                lastDayIndex={isCurrentMonth ? today.getDate() - 1 : undefined}
                startLabel={`${getShortMonthName(month.key)} 1`}
                midLabel={`${getShortMonthName(month.key)} 15`}
                endLabel={`${getShortMonthName(month.key)} ${month.daily.length}`}
              />
            ) : (
              <MonthBars
                months={visibleMonths.map(item => ({
                  key: item.key,
                  label: getShortMonthName(item.key),
                  total: item.total,
                }))}
                selectedKey={selectedKey}
                onSelect={setPickedKey}
              />
            )}
          </View>
          {isSingleMonth && isFirstMonth && (
            <>
              <View className="mt-3.5 h-px bg-[#2A2A2A]" />
              <Text className="mt-3 text-[13px] text-white/50">
                Month-by-month comparison starts in{' '}
                {getMonthName(shiftMonthKey(insights.currentMonthKey, 1))}
              </Text>
            </>
          )}
        </Card>
        <CategoriesCard month={month} highlightKey={highlightKey} />
        <SubscriptionsCard
          month={month}
          categoryLimit={insights.subscriptionCategoryLimit}
          discountRate={insights.subscriptionDiscountRate}
          isCurrentMonth={isCurrentMonth}
        />
      </>
    );
  }

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-3 px-4 py-6 pb-32 md:py-12">
        <View className="mb-3">
          <Header />
        </View>
        {body}
      </View>
    </PageLayout>
  );
}
