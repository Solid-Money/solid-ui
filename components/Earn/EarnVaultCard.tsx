import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';

interface EarnVaultCardProps {
  assetName: string;
  apy: number;
  background: AssetPath;
  isApyLoading: boolean;
  onPress: () => void;
}

/** One Figma banknote-textured entry point into a savings vault. */
export const EarnVaultCard = ({
  assetName,
  apy,
  background,
  isApyLoading,
  onPress,
}: EarnVaultCardProps) => (
  <Pressable
    accessibilityLabel={`Earn interest on ${assetName}`}
    accessibilityRole="button"
    onPress={onPress}
    className="h-[149px] overflow-hidden rounded-[20px] bg-[#1C1C1C] transition-all active:scale-[0.98] active:opacity-90"
  >
    <Image
      source={getAsset(background)}
      contentFit="cover"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    <View className="flex-1 justify-between px-6 pb-6 pt-[25px]">
      <View>
        <Text className="text-[18px] font-semibold leading-5 text-white">Earn on {assetName}</Text>
        <Text className="mt-1 text-[14px] leading-4 text-white/70">
          Earn interest on your {assetName}
        </Text>
      </View>

      {isApyLoading ? (
        <Skeleton className="h-[26px] w-20 rounded-full bg-white/10" />
      ) : (
        <View className="h-[26px] w-20 items-center justify-center self-start overflow-hidden rounded-full">
          <Image
            source={getAsset('images/earn-apy-glass.png')}
            contentFit="fill"
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.apyGlassArtwork]}
          />
          <Text className="text-[16px] font-medium leading-4 text-[#94F27F]" style={styles.apyText}>
            {apy.toFixed(1)} APY
          </Text>
        </View>
      )}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  apyGlassArtwork: {
    opacity: 0.75,
    zIndex: 0,
  },
  apyText: {
    position: 'relative',
    zIndex: 1,
  },
});
