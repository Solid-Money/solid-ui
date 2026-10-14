import { Children, Fragment, isValidElement, ReactNode } from 'react';
import {
  AccessibilityState,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import ProfileHubIcon from './ProfileHubIcon';

export type ProfileRowTone = 'muted' | 'warning' | 'positive';

interface ProfileRowProps {
  icon: ReactNode;
  title: string;
  /** A second line under the title, e.g. the username on Account details. */
  subtitle?: string;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  /** Right-aligned status text before the chevron ("Credit mode", "Add 2FA"). */
  value?: string;
  valueTone?: ProfileRowTone;
  valueIcon?: ReactNode;
  variant?: 'default' | 'hub';
  /** A pill on the right in place of `value`, e.g. "Verified". */
  badge?: string;
  /** Replaces the chevron, e.g. a copy button. */
  accessory?: ReactNode;
  /** `danger` draws the destructive row: red title on a red-tinted icon. */
  tone?: 'default' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
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
  titleNumberOfLines = 1,
  subtitleNumberOfLines = 1,
  value,
  valueTone = 'muted',
  valueIcon,
  variant = 'default',
  badge,
  accessory,
  tone = 'default',
  isLoading,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityState,
}: ProfileRowProps) => {
  const isDanger = tone === 'danger';
  const isHub = variant === 'hub';
  const { width } = useWindowDimensions();

  const content = (
    <View
      className={cn(
        'flex-row items-center gap-3 px-4',
        isHub ? 'min-h-[68px] py-4' : subtitle ? 'py-3' : 'py-3.5',
      )}
      style={isHub && width < 360 ? { gap: 8 } : undefined}
    >
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-full',
          isDanger ? 'bg-[#FF7D7D]/15' : 'bg-[#2A2A2A]',
        )}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            isHub ? 'text-[16px] font-semibold leading-[23px]' : 'text-base font-semibold',
            isDanger ? 'text-[#FF7D7D]' : 'text-white',
          )}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={cn(
              'text-sm',
              isHub ? 'mt-0.5 leading-[20px] text-[#ACACAC]' : 'text-[#8E8E8E]',
            )}
            numberOfLines={subtitleNumberOfLines}
          >
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
      ) : value && isHub ? (
        <View
          className={cn(
            'flex-row items-center gap-1 rounded-full px-2.5 py-1',
            valueTone === 'warning'
              ? 'bg-[#FFB347]/15'
              : valueTone === 'positive'
                ? 'bg-[#94F27F]/15'
                : 'bg-[#333333]',
          )}
        >
          {valueIcon}
          <Text
            className={cn(
              'text-[13px] font-medium leading-[16px]',
              valueTone === 'warning'
                ? 'text-[#FFB347]'
                : valueTone === 'positive'
                  ? 'text-[#94F27F]'
                  : 'text-white/70',
            )}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
      ) : value ? (
        <Text className={cn('text-base', VALUE_TONE[valueTone])} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory ??
        (onPress ? (
          isHub ? (
            <View className="opacity-40">
              <ProfileHubIcon name="chevron-right" size={16} />
            </View>
          ) : (
            <ChevronRight size={18} color="#8E8E8E" />
          )
        ) : null)}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      className="active:opacity-70 web:hover:bg-[#242424]"
    >
      {content}
    </Pressable>
  );
};

/** A rounded card of rows with hairlines between them, inset to the titles. */
export const ProfileRowGroup = ({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'hub';
}) => {
  // Conditional rows arrive as `false`/`null`; dividers only go between real ones.
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View
      className={cn(
        'overflow-hidden bg-[#1C1C1C]',
        variant === 'hub' ? 'rounded-[20px] py-1' : 'rounded-2xl',
      )}
    >
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 && variant !== 'hub' ? <View className="ml-[64px] h-px bg-white/10" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
};

export const ProfileSectionLabel = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-6 text-sm text-[#8E8E8E]">{children}</Text>
);
