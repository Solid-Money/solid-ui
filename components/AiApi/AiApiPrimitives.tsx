import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronRight } from 'lucide-react-native';

import { CheckIcon, CopyIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** The design's brand green and the amber the paused / limit states use. */
export const AI_API_BRAND = '#94F27F';
export const AI_API_AMBER = '#F5A524';
export const AI_API_DANGER = '#FF6B6B';

/** Lucide at the stroke the design's new icons were drawn with. */
export const AI_API_ICON_STROKE = 1.75;

const COPIED_FEEDBACK_MS = 1600;

type Tone = 'neutral' | 'brand' | 'warning' | 'danger';

const TILE_TONES: Record<Tone, string> = {
  neutral: 'bg-[#2A2A2A]',
  brand: 'bg-brand/15',
  warning: 'bg-[#F5A524]/20',
  danger: 'bg-[#FF6B6B]/15',
};

/** A round tile behind an icon: 36pt in rows, larger on heroes and sheets. */
export const AiApiIconTile = ({
  children,
  size = 36,
  tone = 'neutral',
}: {
  children: ReactNode;
  size?: number;
  tone?: Tone;
}) => (
  <View
    className={cn('items-center justify-center rounded-full', TILE_TONES[tone])}
    style={{ width: size, height: size }}
  >
    {children}
  </View>
);

/** A grouped list card; `sheet` is the lighter fill rows take inside a sheet. */
export const AiApiGroup = ({
  children,
  surface = 'card',
  className,
}: {
  children: ReactNode;
  surface?: 'card' | 'sheet';
  className?: string;
}) => (
  <View
    className={cn(
      'w-full overflow-hidden rounded-twice',
      surface === 'sheet' ? 'bg-[#262626]' : 'bg-card',
      className,
    )}
  >
    {children}
  </View>
);

/** The hairline between rows, inset to start under the row text. */
export const AiApiDivider = () => <View className="ml-16 h-px bg-[#2A2A2A]" />;

/** A small pill: "New" in green, "Paused" / "Limit reached" in amber. */
export const AiApiChip = ({ label, tone }: { label: string; tone: 'brand' | 'warning' }) => (
  <View
    className={cn('rounded-full px-2.5 py-1', tone === 'brand' ? 'bg-brand/15' : 'bg-[#FFB347]/15')}
  >
    <Text
      className={cn('text-[13px] font-medium', tone === 'brand' ? 'text-brand' : 'text-[#FFB347]')}
    >
      {label}
    </Text>
  </View>
);

/**
 * One row of a grouped list: icon tile, title and optional subtitle, then a
 * value or a chip, then a chevron when the row goes somewhere.
 */
export const AiApiRow = ({
  icon,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
    disabled={!onPress}
    onPress={onPress}
    className="min-h-[60px] flex-row items-center gap-3 px-4 py-3 active:opacity-70 web:hover:bg-white/5"
  >
    <AiApiIconTile>{icon}</AiApiIconTile>
    <View className="flex-1 gap-0.5">
      <Text className="text-[16px] font-semibold text-white" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-[14px] text-[#ACACAC]" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {trailing}
    {value ? <Text className="text-[15px] text-[#ACACAC]">{value}</Text> : null}
    {onPress ? <ChevronRight size={16} color="white" opacity={0.4} /> : null}
  </Pressable>
);

/** A label on the left and its value on the right, for detail cards. */
export const AiApiInfoRow = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <View className="flex-row items-center justify-between gap-3">
    <Text className="text-[14px] text-white/60">{label}</Text>
    <Text className={cn('text-[14px] font-semibold text-white', valueClassName)}>{value}</Text>
  </View>
);

/**
 * "Copy" as a pill, turning into a tick for a moment once used. The glyphs are
 * the card screen's, so copying looks the same everywhere in the app.
 */
export const AiApiCopyPill = ({
  text,
  accessibilityLabel,
  compact = false,
  onCopied,
}: {
  text: string;
  accessibilityLabel: string;
  compact?: boolean;
  onCopied?: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reset.current) clearTimeout(reset.current);
    },
    [],
  );

  const handlePress = useCallback(async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    onCopied?.();
    if (reset.current) clearTimeout(reset.current);
    reset.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  }, [onCopied, text]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied' : accessibilityLabel}
      onPress={handlePress}
      hitSlop={8}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full bg-[#2A2A2A] active:opacity-70 web:hover:bg-[#333333]',
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
      )}
    >
      {copied ? <CheckIcon size={compact ? 13 : 14} /> : <CopyIcon size={compact ? 13 : 14} />}
      <Text className={cn('font-medium text-white', compact ? 'text-[12px]' : 'text-[13px]')}>
        {copied ? 'Copied' : 'Copy'}
      </Text>
    </Pressable>
  );
};

/** A labelled value in mono with Copy beside it: the key, the base URL. */
export const AiApiCopyField = ({
  label,
  value,
  onCopied,
}: {
  label: string;
  value: string;
  onCopied?: () => void;
}) => (
  <View className="flex-row items-center gap-3">
    <View className="flex-1 gap-1">
      <Text className="text-[13px] text-white/55">{label}</Text>
      <Text className="font-mono text-[14px] leading-5 text-white" selectable>
        {value}
      </Text>
    </View>
    <AiApiCopyPill text={value} accessibilityLabel={`Copy ${label}`} onCopied={onCopied} />
  </View>
);

/** A dark block of code with what it is above it and Copy beside that. */
export const AiApiCodeBlock = ({
  label,
  icon,
  display,
  copy,
  onCopied,
}: {
  label: string;
  icon: ReactNode;
  display: string;
  copy: string;
  onCopied?: () => void;
}) => (
  <View className="w-full gap-2.5 rounded-2xl border border-white/[0.08] bg-[#0A0A0A] px-4 pb-4 pt-3.5">
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-[13px] text-white/50">{label}</Text>
      </View>
      <AiApiCopyPill text={copy} compact accessibilityLabel={`Copy ${label}`} onCopied={onCopied} />
    </View>
    <Text className="font-mono text-[12px] leading-5 text-[#E6E6E6]" selectable>
      {display}
    </Text>
  </View>
);

/**
 * The monthly-limit choices: the preset amounts and Custom, white when chosen.
 * Custom is selected whenever the value is not one of the presets.
 */
export const AiApiLimitOptions = ({
  options,
  value,
  custom,
  onSelect,
  onCustom,
}: {
  options: number[];
  value: number | null;
  /** Force Custom on — a typed amount that happens to match a preset is still custom. */
  custom?: boolean;
  onSelect: (value: number) => void;
  onCustom: () => void;
}) => {
  const isCustom = custom ?? (value !== null && !options.includes(value));
  const items: { key: string; label: string; selected: boolean; onPress: () => void }[] = [
    ...options.map(option => ({
      key: String(option),
      label: `$${option}`,
      selected: !isCustom && value === option,
      onPress: () => onSelect(option),
    })),
    { key: 'custom', label: 'Custom', selected: isCustom, onPress: onCustom },
  ];

  return (
    <View className="flex-row gap-2">
      {items.map(item => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: item.selected }}
          onPress={item.onPress}
          className={cn(
            'flex-1 items-center justify-center rounded-full py-2.5 active:opacity-80',
            item.selected ? 'bg-white' : 'bg-[#262626]',
          )}
        >
          <Text
            className={cn(
              'text-[15px]',
              item.selected ? 'font-semibold text-black' : 'font-medium text-white',
            )}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

/** A thin bar for how much of a limit is used. */
export const AiApiProgress = ({ progress }: { progress: number }) => (
  <View className="h-2 w-full overflow-hidden rounded bg-white/10">
    <View
      className="h-2 rounded bg-brand"
      style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
    />
  </View>
);

/**
 * The amber notice at the top of the dashboard when keys are stopped: what
 * happened, what fixes it, and the button that does.
 */
export const AiApiBanner = ({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  isLoading,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  /** Left out when nothing in the app fixes it, such as a pause by support. */
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
}) => (
  <View className="w-full flex-row items-start gap-3 rounded-twice border border-[#F5A524]/30 bg-[#F5A524]/10 p-4">
    <AiApiIconTile size={40} tone="warning">
      {icon}
    </AiApiIconTile>
    <View className="flex-1 gap-1">
      <Text className="text-[16px] font-semibold text-white">{title}</Text>
      <Text className="text-[14px] leading-[19px] text-white/70">{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          disabled={isLoading}
          className={cn(
            'mt-1.5 flex-row items-center gap-2 self-start rounded-full bg-white px-4 py-[9px] active:opacity-80',
            isLoading && 'opacity-60',
          )}
        >
          {isLoading ? <ActivityIndicator size="small" color="black" /> : null}
          <Text className="text-[14px] font-bold text-black">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  </View>
);
