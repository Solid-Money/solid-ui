import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const TAB_SUMMARY_LABEL = 'text-base font-medium leading-6 text-muted-foreground';
export const TAB_SUMMARY_BADGE = 'min-h-8 flex-row items-center gap-1.5 rounded-full px-3';
export const TAB_SUMMARY_BADGE_LABEL = 'text-sm font-medium leading-5';
export const TAB_SUMMARY_ACTION_ROW = 'flex-row items-center gap-3 px-4';
export const TAB_SUMMARY_ACTION_HEIGHT = 'h-14';

export const useCompactTabSummaryActions = () => {
  const { width } = useWindowDimensions();
  // Fit the three Wallet actions on small screens and match their labels across tabs.
  return width > 0 && width < 400;
};

export const TabSummaryActionButton = ({
  label,
  primary = false,
  icon,
  className,
  ...props
}: ComponentProps<typeof Pressable> & { label: string; primary?: boolean; icon?: ReactNode }) => {
  const compact = useCompactTabSummaryActions();

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      className={cn(
        TAB_SUMMARY_ACTION_HEIGHT,
        'flex-row items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80',
        compact ? 'gap-1.5 px-1.5' : 'gap-2 px-4',
        primary ? 'bg-white' : 'bg-[#1C1C1C]',
        className,
      )}
    >
      {icon}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.2}
        className={cn(
          'native:min-w-0 native:shrink',
          compact ? 'text-[14px] leading-5' : 'text-[16px] leading-6',
          primary ? 'font-bold text-black' : 'font-semibold text-white',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const TabSummary = ({ headline, actions }: { headline: ReactNode; actions: ReactNode }) => (
  <View className="gap-5">
    {headline}
    {actions}
  </View>
);

export const TabSummaryHeadline = ({
  label,
  value,
  badge,
}: {
  label: ReactNode;
  value: ReactNode;
  badge?: ReactNode;
}) => {
  const { fontScale } = useWindowDimensions();

  return (
    <View className="items-center gap-1 px-4 pt-2">
      <View className="min-h-6 items-center justify-center">{label}</View>
      {/* Rolling digits need room to animate without changing the layout. */}
      <View className="items-center justify-center" style={{ height: 54 * fontScale }}>
        {value}
      </View>
      {/* Keep the action row in place even when there is no badge. */}
      <View className="min-h-8 w-full items-center justify-center">{badge}</View>
    </View>
  );
};

export const TabSummaryActionSkeleton = ({ count }: { count: number }) => (
  <View className={TAB_SUMMARY_ACTION_ROW}>
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className={`${TAB_SUMMARY_ACTION_HEIGHT} flex-1 rounded-full`} />
    ))}
  </View>
);
