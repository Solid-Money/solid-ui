import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Address } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { VAULTS } from '@/constants/vaults';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { getAsset } from '@/lib/assets';
import { Vault } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';
import { useSavingStore } from '@/store/useSavingStore';

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
  const { selectedVault, setSelectedVault } = useSavingStore(
    useShallow(state => ({
      selectedVault: state.selectedVault,
      setSelectedVault: state.setSelectedVault,
    })),
  );
  const { user } = useUser();
  const { maxAPY } = useMaxAPY();
  const { isScreenMedium } = useDimension();
  const vaultIndex = VAULTS.findIndex(v => v.name === vault.name);
  const isSelected = selectedVault === vaultIndex;
  const isComingSoon = !!vault.isComingSoon;
  const gapHeight = isScreenMedium ? 12 : 0;
  const iconSizeSelected = isScreenMedium ? 53 : 28;

  const { data: vaultTokenBalance } = useVaultBalance(user?.safeAddress as Address, vault);
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);
  const vaultBalance =
    vaultTokenBalance !== undefined ? vaultTokenBalance * (exchangeRate ?? 1) : undefined;

  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, TIMING_CONFIG);
  }, [isSelected, progress]);

  const animatedIconStyle = useAnimatedStyle(() => {
    const size = ICON_SIZE_COLLAPSED + (iconSizeSelected - ICON_SIZE_COLLAPSED) * progress.value;
    return {
      width: size,
      height: size,
    };
  }, [iconSizeSelected]);

  const animatedBalanceStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    height: progress.value * LINE_HEIGHT,
    overflow: 'hidden' as const,
  }));

  const animatedGapStyle = useAnimatedStyle(
    () => ({
      height: progress.value * gapHeight,
    }),
    [gapHeight],
  );

  const animatedGradientStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.3,
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(167, 139, 250, ${progress.value * 0.5})`,
  }));

  const handlePress = () => {
    if (isComingSoon) {
      return;
    }
    setSelectedVault(vaultIndex);
  };

  return (
    <Pressable onPress={handlePress} disabled={isComingSoon}>
      <Animated.View
        style={[
          animatedBorderStyle,
          {
            overflow: 'hidden',
            borderRadius: 20,
            borderWidth: 1,
            width: isScreenMedium ? 192 : 152,
            height: isScreenMedium ? undefined : 123,
            position: 'relative',
            paddingHorizontal: isScreenMedium ? 24 : 14,
            paddingVertical: isScreenMedium ? 20 : 12,
            opacity: isComingSoon ? 0.5 : 1,
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

        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <Animated.Image
            source={getAsset(vault.icon)}
            style={animatedIconStyle}
            resizeMode="contain"
          />

          <Animated.View style={animatedGapStyle} />

          <View className="mt-2 flex-row items-end justify-between">
            <View>
              <Text className="text-lg font-bold">{vault.name}</Text>
              {vaultBalance !== undefined ? (
                <Animated.View style={animatedBalanceStyle}>
                  <Text className="text-base font-semibold opacity-70">
                    {vault.name === 'USDC' ? (
                      `$${compactNumberFormat(vaultBalance)}`
                    ) : (
                      <>
                        {compactNumberFormat(vaultBalance)}{' '}
                        <Text className="text-sm font-semibold">{vault.name}</Text>
                      </>
                    )}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
            {isComingSoon ? (
              <Text className="text-end text-sm font-semibold opacity-70">Coming soon</Text>
            ) : maxAPY ? (
              <Text className="text-base font-semibold opacity-70">{maxAPY.toFixed(2)}%</Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default SavingVault;
