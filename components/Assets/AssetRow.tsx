import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatBalanceUSD } from '@/lib/utils';

export const HIDDEN_AMOUNT = '••••';
export const assetAmountLabel = (amount: number | undefined, hidden = false) =>
  hidden
    ? HIDDEN_AMOUNT
    : amount === undefined
      ? '—'
      : `${amount < 0 ? '−' : ''}${formatBalanceUSD(Math.abs(amount))}`;

export default function AssetRow({
  title,
  subtitle,
  icon,
  value,
  hidden = false,
  detail,
  trailing,
  onPress,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: ReactNode;
  value: number | undefined;
  hidden?: boolean;
  detail?: string;
  /** Replaces the amount column, e.g. the new user's "Start" on Earn. */
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      {icon}
      <View className="min-w-0 flex-1 gap-[3px]">
        <Text className="text-[16px] font-semibold text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && <Text className="text-[14px] font-normal text-white/60">{subtitle}</Text>}
      </View>
      {trailing ?? (
        <View className="shrink-0 items-end gap-[3px]">
          <Text className="text-[16px] font-semibold text-white">
            {assetAmountLabel(value, hidden)}
          </Text>
          {detail && <Text className="text-[13px] font-normal text-[#94F27F]">{detail}</Text>}
        </View>
      )}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${title}`}
      onPress={onPress}
      className="flex-row items-center gap-[12px] px-[16px] py-[14px] active:bg-white/5"
    >
      {content}
    </Pressable>
  ) : (
    <View className="flex-row items-center gap-[12px] px-[16px] py-[14px]">{content}</View>
  );
}
