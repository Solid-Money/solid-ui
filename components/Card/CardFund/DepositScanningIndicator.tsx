import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

const INDICATOR_ASSET = require('@/assets/images/deposit-scanner-indicator.png');
const INDICATOR_SIZE = 17;
const ROTATION_DURATION_MS = 2000;

/** The continuously rotating deposit scanner indicator from Figma. */
export default function DepositScanningIndicator() {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(rotation);
    rotation.value = 0;

    if (!reduceMotion) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: ROTATION_DURATION_MS,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }

    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.indicator, animatedStyle]}
    >
      <Image resizeMode="contain" source={INDICATOR_ASSET} style={styles.indicator} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
  },
});
