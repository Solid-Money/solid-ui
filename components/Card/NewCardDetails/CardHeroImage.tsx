import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useCardHeroStore } from '@/store/useCardHeroStore';

const TIMING = { duration: 400, easing: Easing.out(Easing.cubic) };

/**
 * Wraps the card image on the new card-details screen and, when arriving from
 * the home wallet card (fromRect set in useCardHeroStore), animates the card
 * from that window rect up to its resting position — a lightweight "view
 * transition" for the card. Measures its own resting rect, so it tracks the real
 * home-card position. Degrades to a no-op when there's no fromRect (e.g. direct
 * navigation) or measurement is unavailable.
 */
const CardHeroImage = ({ children }: { children: React.ReactNode }) => {
  const fromRect = useCardHeroStore(state => state.fromRect);
  const clear = useCardHeroStore(state => state.clear);

  const measureRef = useRef<View>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  // Start hidden only when a hero is pending, so we don't flash the resting
  // position before measuring.
  const opacity = useSharedValue(fromRect ? 0 : 1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!fromRect || done) return;

    const raf = requestAnimationFrame(() => {
      const node = measureRef.current;
      if (!node) {
        opacity.value = 1;
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        setDone(true);
        if (!width || !height) {
          opacity.value = 1;
          clear();
          return;
        }
        const fromCx = fromRect.x + fromRect.width / 2;
        const fromCy = fromRect.y + fromRect.height / 2;
        const toCx = x + width / 2;
        const toCy = y + height / 2;

        tx.value = fromCx - toCx;
        ty.value = fromCy - toCy;
        scale.value = fromRect.width / width;
        opacity.value = 1;

        tx.value = withTiming(0, TIMING);
        ty.value = withTiming(0, TIMING);
        scale.value = withTiming(1, TIMING, finished => {
          if (finished) runOnJS(clear)();
        });
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [fromRect, done, tx, ty, scale, opacity, clear]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View ref={measureRef} collapsable={false}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
};

export default CardHeroImage;
