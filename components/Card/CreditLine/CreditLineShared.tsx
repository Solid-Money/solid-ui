import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessagesSquare } from 'lucide-react-native';

import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { cn, formatNumber } from '@/lib/utils';

import { useCreditLine } from './useCreditLine';

export const CREDIT_LINE_SUPPORT_URL =
  'https://support.solid.xyz/en/articles/13545322-borrow-against-your-savings';

export const openCreditLineSupport = () => Linking.openURL(CREDIT_LINE_SUPPORT_URL);

/** Net rate formatted with a leading sign, e.g. "+2.66%". */
export const formatNetRate = (netAPY: number) =>
  `${netAPY >= 0 ? '+' : ''}${formatNumber(netAPY, 2)}%`;

export type DetailRow = {
  label: string;
  value?: React.ReactNode;
  valueClassName?: string;
  tooltip?: string;
  loading?: boolean;
};

/**
 * A dark rounded card of label/value rows separated by hairline dividers.
 * Pass `gradient` for the green-tinted variant used on the intro screens.
 */
export function DetailCard({
  rows,
  gradient,
  className,
}: {
  rows: DetailRow[];
  gradient?: boolean;
  className?: string;
}) {
  return (
    <View className={cn('overflow-hidden rounded-2xl bg-[#1C1C1C]', className)}>
      {gradient && (
        <LinearGradient
          colors={['rgba(104, 216, 82, 0.2)', 'rgba(104, 216, 82, 0.04)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      )}
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 && <View className="h-px w-full bg-white/10" />}
          <View className="flex-row items-center justify-between px-5 py-4">
            <View className="flex-row items-center gap-1.5">
              <Text className="native:text-base text-base text-white/70">{row.label}</Text>
              {row.tooltip && <TooltipPopover text={row.tooltip} analyticsContext="credit_line" />}
            </View>
            {row.loading ? (
              <Skeleton className="h-5 w-16 rounded-md bg-white/10" />
            ) : typeof row.value === 'string' ? (
              <Text
                className={cn(
                  'native:text-base text-base font-bold text-white',
                  row.valueClassName,
                )}
              >
                {row.value}
              </Text>
            ) : (
              row.value
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Collateral / rate / cost breakdown for a given borrow `amount`. Shared by the
 * borrow form and the confirm screen so they always show the same figures.
 */
export function BorrowDetailsCard({ amount }: { amount: number }) {
  const { borrowAPY, savingsAPY, collateralRequired, estMonthlyCost, isLoading } = useCreditLine();

  return (
    <DetailCard
      rows={[
        {
          label: 'Collateral required',
          value: `${formatNumber(collateralRequired(amount))} USDC`,
          loading: isLoading,
        },
        { label: 'Borrow rate', value: `${formatNumber(borrowAPY, 2)}%`, loading: isLoading },
        {
          label: 'Savings keep earning',
          value: `${formatNumber(savingsAPY, 2)}%`,
          valueClassName: 'text-brand',
          loading: isLoading,
        },
        {
          label: 'Est. cost',
          value: `~$${formatNumber(estMonthlyCost(amount))} / mo`,
          loading: isLoading,
        },
      ]}
    />
  );
}

const NET_RATE_TOOLTIP = 'This is the yield you will earn on your borrowed savings balance';

/** Borrow rate / Savings rate / Net rate breakdown (green card). */
export function RateBreakdownCard({ className }: { className?: string }) {
  const { borrowAPY, savingsAPY, netAPY, isLoading } = useAaveBorrowPosition();

  return (
    <DetailCard
      gradient
      className={className}
      rows={[
        { label: 'Borrow rate', value: `${formatNumber(borrowAPY, 2)}%`, loading: isLoading },
        { label: 'Savings rate', value: `${formatNumber(savingsAPY, 2)}%`, loading: isLoading },
        {
          label: 'Net rate',
          tooltip: NET_RATE_TOOLTIP,
          value: formatNetRate(netAPY),
          valueClassName: 'text-brand',
          loading: isLoading,
        },
      ]}
    />
  );
}

/** "Healthy" status pill + reassurance copy + support link. */
export function HealthyBadge({ healthy = true }: { healthy?: boolean }) {
  return (
    <View className="gap-3 rounded-2xl bg-[#1C1C1C] p-5">
      <View className="flex-row items-center gap-2 self-start rounded-full bg-brand/15 px-3 py-1.5">
        <View className={cn('h-2 w-2 rounded-full', healthy ? 'bg-brand' : 'bg-yellow-400')} />
        <Text className={cn('text-sm font-medium', healthy ? 'text-brand' : 'text-yellow-400')}>
          {healthy ? 'Healthy' : 'At risk'}
        </Text>
      </View>
      <Text className="text-sm text-white/60">
        Your savings back this loan and keep earning more than it costs. Nothing to do.
      </Text>
      <Pressable onPress={openCreditLineSupport} className="web:hover:opacity-70">
        <Text className="text-sm font-bold text-white">What could change this ›</Text>
      </Pressable>
    </View>
  );
}

/** "Need help?" footer link. */
export function NeedHelp({ className }: { className?: string }) {
  return (
    <Pressable
      onPress={openCreditLineSupport}
      className={cn(
        'flex-row items-center justify-center gap-2 py-2 web:hover:opacity-70',
        className,
      )}
    >
      <MessagesSquare size={18} color="rgba(255,255,255,0.7)" />
      <Text className="text-base text-white/70">Need help?</Text>
    </Pressable>
  );
}
