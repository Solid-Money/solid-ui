import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const PASSKEY_OUTLINE = require('@/assets/images/passkey-outline-glow.png');
const PASSKEY_FINGERPRINT = require('@/assets/images/passkey-fingerprint-glow.png');

export function AnimatedPasskeyIcon() {
  const reduceMotion = useReducedMotion();
  const iconOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const iconRotation = useSharedValue(reduceMotion ? 0 : 10);
  const iconScale = useSharedValue(reduceMotion ? 1 : 0.92);
  const fingerprintOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      iconOpacity.value = 1;
      iconRotation.value = 0;
      iconScale.value = 1;
      fingerprintOpacity.value = 1;
      return;
    }

    iconOpacity.value = withDelay(
      80,
      withTiming(1, {
        duration: 540,
        easing: Easing.out(Easing.cubic),
      }),
    );
    iconRotation.value = withDelay(
      80,
      withTiming(0, {
        duration: 920,
        easing: Easing.out(Easing.cubic),
      }),
    );
    iconScale.value = withDelay(
      80,
      withTiming(1, {
        duration: 870,
        easing: Easing.out(Easing.back(0.45)),
      }),
    );
    fingerprintOpacity.value = withDelay(
      340,
      withTiming(1, {
        duration: 580,
        easing: Easing.out(Easing.cubic),
      }),
    );

    return () => {
      cancelAnimation(iconOpacity);
      cancelAnimation(iconRotation);
      cancelAnimation(iconScale);
      cancelAnimation(fingerprintOpacity);
    };
  }, [fingerprintOpacity, iconOpacity, iconRotation, iconScale, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ rotate: `${iconRotation.value}deg` }, { scale: iconScale.value }],
  }));
  const fingerprintStyle = useAnimatedStyle(() => ({
    opacity: fingerprintOpacity.value,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, iconStyle]}
    >
      <Animated.Image resizeMode="contain" source={PASSKEY_OUTLINE} style={styles.outline} />
      <Animated.Image
        resizeMode="contain"
        source={PASSKEY_FINGERPRINT}
        style={[styles.fingerprint, fingerprintStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 133,
    height: 75,
  },
  outline: {
    ...StyleSheet.absoluteFillObject,
    width: 133,
    height: 75,
  },
  fingerprint: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 43,
    height: 43,
  },
});
