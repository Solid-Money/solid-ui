import React, { Fragment, ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { CrossChainSendNetworkConfig } from '@/lib/types/cross-chain-send';
import { cn } from '@/lib/utils';
import { NETWORK_ICONS } from '@/lib/utils/cross-chain-send';

export const BRAND = '#94f27f';

type NetworkIconProps = {
  networkKey: CrossChainSendNetworkConfig['key'] | undefined;
  size?: number;
};

/** The network's logo inside a circle with the card-coloured ring the rows use. */
export const NetworkIcon = ({ networkKey, size = 36 }: NetworkIconProps) => (
  <View
    className="items-center justify-center overflow-hidden rounded-full border-[2.25px] border-card bg-[#333]"
    style={{ width: size, height: size }}
  >
    {networkKey ? (
      <Image
        source={getAsset(NETWORK_ICONS[networkKey])}
        style={{ width: size - 4.5, height: size - 4.5 }}
        contentFit="cover"
      />
    ) : null}
  </View>
);

type LetterAvatarProps = {
  letter: string;
  size?: number;
  className?: string;
};

export const LetterAvatar = ({ letter, size = 36, className }: LetterAvatarProps) => (
  <View
    className={cn('items-center justify-center rounded-full bg-[#333]', className)}
    style={{ width: size, height: size }}
  >
    <Text className="text-base font-semibold leading-5 text-white">{letter}</Text>
  </View>
);

type ChipProps = {
  label: string;
  tone?: 'grey' | 'brand';
};

/** Inline pill beside a row title: "Recommended", "~3 min". */
export const Chip = ({ label, tone = 'grey' }: ChipProps) => (
  <View
    className={cn(
      'rounded-[18px] px-2 pb-[3px] pt-[2px]',
      tone === 'brand' ? 'bg-[rgba(148,242,127,0.16)]' : 'bg-[#333]',
    )}
  >
    <Text className={cn('text-sm leading-4', tone === 'brand' ? 'text-brand' : 'text-white/70')}>
      {label}
    </Text>
  </View>
);

export type DetailRowSpec = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

type DetailCardProps = {
  rows: DetailRowSpec[];
  className?: string;
};

/** Label/value rows in a card, hairline-divided — the quote and review cards. */
export const DetailCard = ({ rows, className }: DetailCardProps) => (
  <View className={cn('overflow-hidden rounded-[15px] bg-card', className)}>
    {rows.map((row, index) => (
      <Fragment key={row.key}>
        {index > 0 ? <View className="h-px bg-white/10" /> : null}
        <View className="flex-row items-center justify-between gap-3 px-[18px] py-[14px]">
          {typeof row.label === 'string' ? (
            <Text className="text-base text-white/70">{row.label}</Text>
          ) : (
            row.label
          )}
          {typeof row.value === 'string' ? (
            <Text className="shrink text-right text-base font-medium text-white">{row.value}</Text>
          ) : (
            row.value
          )}
        </View>
      </Fragment>
    ))}
  </View>
);

export const Divider = () => <View className="h-px bg-white/10" />;

type MaxPillProps = {
  onPress: () => void;
};

/** "Max" beside an available balance: fills the amount with all of it. */
export const MaxPill = ({ onPress }: MaxPillProps) => (
  <Pressable
    onPress={onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel="Use the whole balance"
    className="rounded-[18px] bg-[rgba(148,242,127,0.16)] px-2 pb-[3px] pt-[2px]"
  >
    <Text className="text-sm leading-4 text-brand">Max</Text>
  </Pressable>
);

export type StepTone = 'done' | 'active' | 'pending' | 'failed' | 'confirming';

export type TrackerStep = {
  key: string;
  tone: StepTone;
  title: string;
  subtitle: string;
  subtitleTone?: 'brand' | 'muted' | 'danger';
  onSubtitlePress?: () => void;
};

const DOT_SIZE = 28;

const StepDot = ({ tone }: { tone: StepTone }) => {
  const base = { width: DOT_SIZE, height: DOT_SIZE };
  if (tone === 'done') {
    return (
      <View className="items-center justify-center rounded-full bg-brand" style={base}>
        <Check size={16} color="black" strokeWidth={3} />
      </View>
    );
  }
  if (tone === 'failed') {
    return <View className="rounded-full bg-red-500" style={base} />;
  }
  if (tone === 'confirming') {
    return (
      <View className="items-center justify-center rounded-full border-2 border-brand" style={base}>
        <ActivityIndicator size="small" color={BRAND} />
      </View>
    );
  }
  if (tone === 'active') {
    return (
      <View className="items-center justify-center rounded-full border-2 border-brand" style={base}>
        <View className="h-2 w-2 rounded-full bg-brand" />
      </View>
    );
  }
  return <View className="rounded-full border-2 border-white/25" style={base} />;
};

/**
 * The vertical progress card a cross-network send or swap shows: one dot per
 * step, joined by a line that turns green as steps finish.
 */
export const StepTracker = ({ steps }: { steps: TrackerStep[] }) => (
  <View className="rounded-[15px] bg-card px-[18px] py-5">
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      const titleMuted = step.tone === 'pending';
      return (
        <View key={step.key} className="flex-row gap-3">
          <View className="items-center">
            <StepDot tone={step.tone} />
            {!isLast ? (
              <View
                className={cn('w-[2px]', step.tone === 'done' ? 'bg-brand' : 'bg-white/15')}
                style={{ height: 34 }}
              />
            ) : null}
          </View>
          <View className={cn('flex-1 gap-0.5', !isLast && 'pb-2')}>
            <Text
              className={cn(
                'text-base font-semibold leading-6',
                titleMuted ? 'text-white/50' : 'text-white',
              )}
            >
              {step.title}
            </Text>
            <Pressable onPress={step.onSubtitlePress} disabled={!step.onSubtitlePress}>
              <Text
                className={cn(
                  'text-sm leading-[18px]',
                  step.subtitleTone === 'brand' && 'text-brand',
                  step.subtitleTone === 'danger' && 'text-red-400',
                  (!step.subtitleTone || step.subtitleTone === 'muted') && 'text-white/60',
                )}
              >
                {step.subtitle}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    })}
  </View>
);
