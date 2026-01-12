import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY, useTVL } from '@/hooks/useAnalytics';
import { getAsset } from '@/lib/assets';
import { Vault } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';
import { useSavingStore } from '@/store/useSavingStore';
import { useDimension } from '@/hooks/useDimension';

const ANIMATION_DURATION = 300;
const TIMING_CONFIG = {
  duration: ANIMATION_DURATION,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const ICON_SIZE_COLLAPSED = 28;
const LINE_HEIGHT = 24;

interface SavingVaultProps {
  vault: Vault;
}

const SavingVault = ({ vault }: SavingVaultProps) => {
  const { selectedVault, setSelectedVault } = useSavingStore();
  const { data: tvl } = useTVL();
  const { maxAPY } = useMaxAPY();
  const { isScreenMedium } = useDimension();
  const vaultIndex = VAULTS.findIndex(v => v.name === vault.name);
  const isSelected = selectedVault === vaultIndex;
  const GAP_HEIGHT = isScreenMedium ? 40 : 16;
  const ICON_SIZE_SELECTED = isScreenMedium ? 53 : 28;

  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, TIMING_CONFIG);
  }, [isSelected, progress]);

  const animatedIconStyle = useAnimatedStyle(() => {
    const size = ICON_SIZE_COLLAPSED + (ICON_SIZE_SELECTED - ICON_SIZE_COLLAPSED) * progress.value;
    return {
      width: size,
      height: size,
    };
  });

  const animatedBalanceStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    height: progress.value * LINE_HEIGHT,
    overflow: 'hidden' as const,
  }));

  const animatedGapStyle = useAnimatedStyle(() => ({
    height: progress.value * GAP_HEIGHT,
  }));

  const animatedGradientStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.3,
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(167, 139, 250, ${progress.value * 0.5})`,
  }));

  const handlePress = () => {
    setSelectedVault(vaultIndex);
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          animatedBorderStyle,
          {
            overflow: 'hidden',
            borderRadius: 20,
            borderWidth: 1,
            width: isScreenMedium ? 192 : 144,
            position: 'relative',
            paddingHorizontal: 16,
            paddingVertical: isScreenMedium ? 20 : 16,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: -2,
            backgroundColor: '#1C1C1C',
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: -1,
            },
            animatedGradientStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.7)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <View>
          <Animated.Image
            source={getAsset(vault.icon)}
            style={animatedIconStyle}
            resizeMode="contain"
          />

          <Animated.View style={animatedGapStyle} />

          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-lg font-bold">{vault.name}</Text>
              {tvl ? (
                <Animated.View style={animatedBalanceStyle}>
                  <Text className="text-base font-semibold opacity-70">
                    ${compactNumberFormat(tvl)}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
            {maxAPY ? (
              <Text className="text-base font-semibold opacity-70">{maxAPY.toFixed(1)}%</Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default SavingVault;
