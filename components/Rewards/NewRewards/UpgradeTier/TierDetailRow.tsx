import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface TierDetailRowProps {
  label: string;
  value: string;
  /** The smaller grey line under the value, e.g. a FUSE amount's USD worth. */
  secondaryValue?: string;
  /** A "?" the user can tap for an explanation, as on the lock-duration row. */
  onExplain?: () => void;
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
  secondaryValue,
  onExplain,
  withDivider = false,
  children,
}: TierDetailRowProps) => (
  <View>
    <View className="min-h-[66px] flex-row items-center justify-between px-5">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-[16px] leading-5 text-white/70">{label}</Text>
        {onExplain ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`What is ${label}?`}
            onPress={onExplain}
            hitSlop={12}
            className="h-[18px] w-[18px] items-center justify-center rounded-full bg-white/10 transition-opacity active:opacity-60"
          >
            <Text className="text-[11px] leading-[13px] text-white/60">?</Text>
          </Pressable>
        ) : null}
      </View>

      {children ?? (
        <View className="ml-4 flex-1 items-end">
          <Text className="text-right text-[16px] font-semibold leading-5 text-white">{value}</Text>
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
