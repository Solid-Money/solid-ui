import { View } from 'react-native';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cashbackFiguresByCurrency } from '@/lib/cashbackProgress';
import { CashbackCurrency } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatInsightAmount } from '@/lib/utils/spendingInsights';

type SpendDeltaLineProps = {
  /** Whole-number percent against the previous month, or null. */
  change: number | null;
  previousMonthName?: string;
  isFirstMonth: boolean;
  /** The month's cashback per currency — USD rows and EUR rows, never summed. */
  cashbackUsd: number;
  cashbackEur?: number;
  /** The cardholder's cashback currency, listed first. */
  cashbackCurrency?: CashbackCurrency;
  align?: 'start' | 'center';
  size?: 'sm' | 'md';
};

/**
 * "↓ 12% vs August · +$38.20 cashback". The change is neutral grey either way:
 * spending more is not an error, and red/green would say it is.
 *
 * Cashback in two currencies reads "+€12.40 + $3.00 cashback", the
 * cardholder's own first: the two are never added together.
 */
export default function SpendDeltaLine({
  change,
  previousMonthName,
  isFirstMonth,
  cashbackUsd,
  cashbackEur,
  cashbackCurrency = 'USD',
  align = 'start',
  size = 'md',
}: SpendDeltaLineProps) {
  const textSize = size === 'sm' ? 'text-[13px]' : 'text-sm';
  const comparison =
    change !== null && previousMonthName ? (
      <View className="flex-row items-center gap-1">
        {change <= 0 ? (
          <ArrowDown size={13} color="rgba(255,255,255,0.6)" />
        ) : (
          <ArrowUp size={13} color="rgba(255,255,255,0.6)" />
        )}
        <Text className={cn(textSize, 'text-white/60')}>
          {Math.abs(change)}% vs {previousMonthName}
        </Text>
      </View>
    ) : isFirstMonth ? (
      <Text className={cn(textSize, 'text-white/60')}>Your first month with Solid</Text>
    ) : null;

  const cashbackLabel = cashbackFiguresByCurrency(
    { USD: cashbackUsd, EUR: cashbackEur },
    cashbackCurrency,
  )
    .filter(figure => figure.value > 0)
    .map(figure => formatInsightAmount(figure.value, figure.currency))
    .join(' + ');
  const cashback = cashbackLabel ? (
    <Text className={cn(textSize, 'font-medium text-brand')}>+{cashbackLabel} cashback</Text>
  ) : null;

  if (size === 'sm') {
    // Stacked under the gauge's total, where a single line would not fit.
    return (
      <View className={cn('gap-1', align === 'center' ? 'items-center' : 'items-start')}>
        {comparison}
        {cashback}
      </View>
    );
  }

  return (
    <View
      className={cn(
        'flex-row flex-wrap items-center gap-x-1.5 gap-y-1',
        align === 'center' && 'justify-center',
      )}
    >
      {comparison}
      {comparison && cashback && <Text className={cn(textSize, 'text-white/40')}>·</Text>}
      {cashback}
    </View>
  );
}
