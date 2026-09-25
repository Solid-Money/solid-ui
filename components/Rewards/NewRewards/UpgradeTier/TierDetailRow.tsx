import { type ReactNode } from 'react';
import { View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface TierDetailRowProps {
  label: string;
  /** The value, as text. Omitted only when `children` renders it instead. */
  value?: string;
  valueClassName?: string;
  /** The smaller grey line under the value, e.g. a FUSE amount's USD worth. */
  secondaryValue?: string;
  /** A short explanation opened from the question mark beside the label. */
  tooltip?: string;
  tooltipAnalyticsContext?: string;
  /** Drawn under the row. The last row in a card does not have one. */
  withDivider?: boolean;
  /** Replaces the value, for a row that renders something other than text. */
  children?: ReactNode;
}

/**
 * One label/value line in an upgrade card.
 *
 * Every card on the upgrade and confirmation screens is a stack of these —
 * annual fee, balance, FUSE amount, lock duration, tier, fee — so the row is
 * one component. Writing it per screen is how "Annual Fee" and "Lock duration"
 * end up a pixel apart on two screens the user moves between in one tap.
 */
const TierDetailRow = ({
  label,
  value,
  valueClassName,
  secondaryValue,
  tooltip,
  tooltipAnalyticsContext,
  withDivider = false,
  children,
}: TierDetailRowProps) => (
  <View>
    <View className="min-h-[66px] flex-row items-center justify-between px-5">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-[16px] leading-6 text-white/70">{label}</Text>
        {tooltip ? (
          <TooltipPopover
            text={tooltip}
            side="top"
            analyticsContext={tooltipAnalyticsContext}
            accessibilityLabel={`What is ${label}?`}
            classNames={{ trigger: '-mt-[3px]' }}
          />
        ) : null}
      </View>

      {children ?? (
        <View className="ml-4 flex-1 items-end">
          <Text
            className={cn(
              'text-right text-[16px] font-semibold leading-6 text-white',
              valueClassName,
            )}
          >
            {value}
          </Text>
          {secondaryValue ? (
            <Text className="mt-0.5 text-right text-[13px] leading-4 text-white/50">
              {secondaryValue}
            </Text>
          ) : null}
        </View>
      )}
    </View>

    {withDivider ? <View className="h-px bg-white/10" /> : null}
  </View>
);

export default TierDetailRow;
