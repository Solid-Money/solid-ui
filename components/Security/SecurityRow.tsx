import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface SecurityRowBadge {
  label: string;
  tone: 'positive' | 'warning';
}

interface SecurityRowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: SecurityRowBadge;
  /** Omit for a row that only reports state; it then shows no chevron. */
  onPress?: () => void;
  /** Swaps the badge for a spinner while the row's action is in flight. */
  isBusy?: boolean;
  accessibilityLabel?: string;
}

/**
 * One row of a Security group: icon, title, a line of detail, and on the
 * right an optional status badge and a chevron when the row leads somewhere.
 */
const SecurityRow = ({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  isBusy,
  accessibilityLabel,
}: SecurityRowProps) => {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#2A2A2A]">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-[17px] font-semibold text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[15px] text-[#ACACAC]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isBusy ? (
        <ActivityIndicator size="small" color="#ACACAC" />
      ) : badge ? (
        <View
          className={cn('rounded-full px-2.5 py-1', {
            'bg-[#94F27F]/15': badge.tone === 'positive',
            'bg-[#E8A33D]/15': badge.tone === 'warning',
          })}
        >
          <Text
            className={cn('text-sm font-medium', {
              'text-[#94F27F]': badge.tone === 'positive',
              'text-[#E8A33D]': badge.tone === 'warning',
            })}
          >
            {badge.label}
          </Text>
        </View>
      ) : null}
      {onPress ? <ChevronRight size={18} color="#ACACAC" /> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ busy: !!isBusy }}
      disabled={isBusy}
      onPress={onPress}
      className="active:opacity-70 web:hover:bg-[#2A2A2A]"
    >
      {content}
    </Pressable>
  );
};

export default SecurityRow;
