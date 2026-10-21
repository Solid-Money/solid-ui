import { type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { formatApyPercent } from '@/lib/apyFormat';
import { cn } from '@/lib/utils';

const GREEN = '#94F27F';

export const CheckDot = ({ size = 12 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <Circle cx={6} cy={6} r={6} fill={GREEN} />
    <Path
      d="M3.5 6.2L5.2 7.8L8.5 4.4"
      stroke="#111111"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ShieldIcon = ({ size = 13 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <Path
      d="M7 1.5L2.5 3.3V6.6C2.5 9.4 4.4 11.7 7 12.5C9.6 11.7 11.5 9.4 11.5 6.6V3.3L7 1.5Z"
      stroke="white"
      strokeOpacity={0.7}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </Svg>
);

export const LockIcon = ({ size = 11 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <Rect
      x={2.5}
      y={6}
      width={9}
      height={6.5}
      rx={1.5}
      stroke="white"
      strokeOpacity={0.5}
      strokeWidth={1.4}
    />
    <Path
      d="M4.5 6V4.5C4.5 3.1 5.6 2 7 2C8.4 2 9.5 3.1 9.5 4.5V6"
      stroke="white"
      strokeOpacity={0.5}
      strokeWidth={1.4}
    />
  </Svg>
);

/** Rounded chip: green tint for rates and gains, grey for facts. */
export const EarnChip = ({
  label,
  tone = 'neutral',
  icon,
  className,
}: {
  label: string;
  tone?: 'positive' | 'neutral';
  icon?: ReactNode;
  className?: string;
}) => (
  <View
    className={cn(
      'flex-row items-center gap-[6px] rounded-full py-[5px] pl-[10px] pr-[11px]',
      tone === 'positive' ? 'bg-[#94F27F]/15' : 'bg-[#2A2A2A]',
      className,
    )}
  >
    {icon}
    <Text
      className={cn(
        'text-[13px] font-medium leading-[18px]',
        tone === 'positive' ? 'text-[#94F27F]' : 'text-white/70',
      )}
    >
      {label}
    </Text>
  </View>
);

/**
 * The small "4.5% APY" tag on list rows. Without a rate it shows nothing, or `emptyLabel`
 * for a product whose rate is 0 (EUR Yield's "0.0% APY").
 */
export const ApyTag = ({
  apy,
  isLoading,
  emptyLabel,
}: {
  apy: number | undefined;
  isLoading?: boolean;
  emptyLabel?: string;
}) => {
  if (isLoading) return <Skeleton className="h-[18px] w-[60px] rounded-[6px] bg-white/10" />;
  if (apy === undefined || !Number.isFinite(apy) || apy <= 0) {
    return emptyLabel ? (
      <View className="rounded-[6px] bg-white/10 px-[6px] py-[1px]">
        <Text className="text-[12px] font-medium leading-[16px] text-white/60">{emptyLabel}</Text>
      </View>
    ) : null;
  }
  return (
    <View className="rounded-[6px] bg-[#94F27F]/15 px-[6px] py-[1px]">
      <Text className="text-[12px] font-medium leading-[16px] text-[#94F27F]">
        {formatApyPercent(apy)} APY
      </Text>
    </View>
  );
};
