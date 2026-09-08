import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { formatVaultApyLabel } from './earnPortfolio';

interface EarnAssetCardProps {
  assetName: string;
  icon: ReactNode;
  /** Omit for an asset that isn't live yet — the card renders "Soon" and is inert. */
  apy?: number;
  isApyLoading?: boolean;
  onPress?: () => void;
}

/** One tile in the Earn asset grid: what you hold, and what it pays. */
export const EarnAssetCard = ({
  assetName,
  icon,
  apy,
  isApyLoading = false,
  onPress,
}: EarnAssetCardProps) => {
  const isComingSoon = apy === undefined;

  return (
    <Pressable
      accessibilityLabel={
        isComingSoon ? `Earn on ${assetName}, coming soon` : `Earn interest on ${assetName}`
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: isComingSoon }}
      disabled={isComingSoon}
      onPress={onPress}
      className="flex-1 justify-between gap-5 rounded-[20px] bg-[#1C1C1C] p-4 transition-all active:scale-[0.98] active:opacity-90"
    >
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-[15px] font-semibold leading-5 text-white">{assetName}</Text>
      </View>

      <View className="gap-0.5">
        <Text className="text-[13px] leading-4 text-white/50">Earn</Text>
        {isComingSoon ? (
          <Text className="text-[16px] font-medium leading-5 text-[#F5B44C]">Soon</Text>
        ) : isApyLoading ? (
          <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
        ) : (
          <Text className="text-[16px] font-medium leading-5 text-[#94F27F]">
            {formatVaultApyLabel(apy)}
          </Text>
        )}
      </View>
    </Pressable>
  );
};
