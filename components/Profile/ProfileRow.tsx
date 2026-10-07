import { Children, Fragment, isValidElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ProfileRowTone = 'muted' | 'warning' | 'positive';

interface ProfileRowProps {
  icon: ReactNode;
  title: string;
  /** A second line under the title, e.g. the username on Account details. */
  subtitle?: string;
  /** Right-aligned status text before the chevron ("Credit mode", "Add 2FA"). */
  value?: string;
  valueTone?: ProfileRowTone;
  /** A pill on the right in place of `value`, e.g. "Verified". */
  badge?: string;
  /** Replaces the chevron, e.g. a copy button. */
  accessory?: ReactNode;
  /** `danger` draws the destructive row: red title on a red-tinted icon. */
  tone?: 'default' | 'danger';
  isLoading?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const VALUE_TONE: Record<ProfileRowTone, string> = {
  muted: 'text-[#8E8E8E]',
  warning: 'text-[#F2B84B]',
  positive: 'text-[#94F27F]',
};

/**
 * One row of a Profile group: an icon on a disc, the title (and optionally a
 * line under it), and on the right a status, a pill or a custom accessory, then
 * a chevron when the row leads somewhere.
 */
export const ProfileRow = ({
  icon,
  title,
  subtitle,
  value,
  valueTone = 'muted',
  badge,
  accessory,
  tone = 'default',
  isLoading,
  onPress,
  accessibilityLabel,
}: ProfileRowProps) => {
  const isDanger = tone === 'danger';

  const content = (
    <View className={cn('flex-row items-center gap-3 px-4', subtitle ? 'py-3' : 'py-3.5')}>
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-full',
          isDanger ? 'bg-[#FF7D7D]/15' : 'bg-[#2A2A2A]',
        )}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className={cn('text-base font-semibold', isDanger ? 'text-[#FF7D7D]' : 'text-white')}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-[#8E8E8E]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color="#8E8E8E" />
      ) : badge ? (
        <View className="rounded-full bg-[#94F27F]/15 px-2.5 py-1">
          <Text className="text-sm font-medium text-[#94F27F]">{badge}</Text>
        </View>
      ) : value ? (
        <Text className={cn('text-base', VALUE_TONE[valueTone])} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory ?? (onPress ? <ChevronRight size={18} color="#8E8E8E" /> : null)}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      className="active:opacity-70 web:hover:bg-[#242424]"
    >
      {content}
    </Pressable>
  );
};

/** A rounded card of rows with hairlines between them, inset to the titles. */
export const ProfileRowGroup = ({ children }: { children: ReactNode }) => {
  // Conditional rows arrive as `false`/`null`; dividers only go between real ones.
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <View className="ml-[64px] h-px bg-white/10" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
};

export const ProfileSectionLabel = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-6 text-sm text-[#8E8E8E]">{children}</Text>
);
