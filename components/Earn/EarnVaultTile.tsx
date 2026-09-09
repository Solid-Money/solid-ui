import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';

import { formatVaultApyLabel } from './earnPortfolio';

interface EarnVaultTileProps {
  assetName: string;
  apy: number;
  isApyLoading: boolean;
  background: AssetPath;
  icon: AssetPath;
  onPress: () => void;
}

/** One textured half-width entry point into a savings vault. */
export const EarnVaultTile = ({
  assetName,
  apy,
  isApyLoading,
  background,
  icon,
  onPress,
}: EarnVaultTileProps) => (
  <Pressable
    accessibilityLabel={`Earn interest on ${assetName}`}
    accessibilityRole="button"
    onPress={onPress}
    className="h-[170px] flex-1 overflow-hidden rounded-[20px] bg-[#1C1C1C] transition-all active:scale-[0.98] active:opacity-90"
  >
    <Image
      source={getAsset(background)}
      contentFit="cover"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    <View className="flex-1 justify-between p-4">
      <View className="items-start gap-2">
        <Text className="text-[16px] font-semibold leading-5 text-white">Earn on {assetName}</Text>

        {isApyLoading ? (
          <Skeleton className="h-[26px] w-[72px] rounded-full bg-white/10" />
        ) : (
          <View className="h-[26px] justify-center rounded-full bg-white/10 px-[10px]">
            <Text className="text-[14px] font-medium leading-4 text-[#94F27F]">
              {formatVaultApyLabel(apy)}
            </Text>
          </View>
        )}
      </View>

      <View className="size-[52px] items-center justify-center rounded-full bg-white/[0.07]">
        <Image
          source={getAsset(icon)}
          contentFit="contain"
          style={{ width: 26, height: 26 }}
          alt={`${assetName} icon`}
        />
      </View>
    </View>
  </Pressable>
);
