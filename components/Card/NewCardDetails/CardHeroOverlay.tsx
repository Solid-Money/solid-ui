import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CARD_FLIGHT_DURATION, EASE_OUT_EXPO } from '@/components/Card/NewCardDetails/heroMotion';
import NewCardArt from '@/components/Card/NewCardDetails/NewCardArt';
import { useCardHeroStore } from '@/store/useCardHeroStore';

// Figma 20048:3338 — the card travels over 31% of the 2s timeline on a
// cubic-bezier(0.16, 1, 0.3, 1) curve.
const TIMING = { duration: CARD_FLIGHT_DURATION, easing: EASE_OUT_EXPO };
// Safety net: if the destination never reports its rect, don't leave the clone
// stuck on screen — tear the transition down after this long.
const FALLBACK_MS = 1200;

/**
 * Root-level "shared element" overlay for the card. Mounted once above the whole
 * protected navigator (so it spans the home → card/details navigation), it flies
 * a snapshot of the card from the tapped home position (`fromRect`) to the
 * details screen's resting position (`toRect`) on top of both screens — a real
 * cross-page view transition. Renders nothing unless a transition is active, and
 * clears itself when the flight finishes, so it re-runs on every tap.
 */
const CardHeroOverlay = () => {
  const active = useCardHeroStore(state => state.active);
  const fromRect = useCardHeroStore(state => state.fromRect);
  const toRect = useCardHeroStore(state => state.toRect);
  const last4 = useCardHeroStore(state => state.last4);
  const end = useCardHeroStore(state => state.end);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || !fromRect) return;

    // The destination is known at the tap (see getCardHeroDestination), so this
    // normally runs on the tap's own frame. Should it ever be missing, hold the
    // clone still and arm a fallback rather than leaving it stuck on screen.
    if (!toRect) {
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      const timer = setTimeout(() => end(), FALLBACK_MS);
      return () => clearTimeout(timer);
    }

    const fromCx = fromRect.x + fromRect.width / 2;
    const fromCy = fromRect.y + fromRect.height / 2;
    const toCx = toRect.x + toRect.width / 2;
    const toCy = toRect.y + toRect.height / 2;

    // Back to the origin first. These shared values outlive a flight — the clone
    // unmounts but they keep whatever offset it landed on — so without this the next
    // flight would start from the last one's end transform. Dismissing was the case
    // that showed it: the card set off from roughly a screen-height above the pane
    // and covered twice the distance it should have.
    tx.value = 0;
    ty.value = 0;
    scale.value = 1;

    tx.value = withTiming(toCx - fromCx, TIMING);
    ty.value = withTiming(toCy - fromCy, TIMING);
    scale.value = withTiming(toRect.width / fromRect.width, TIMING, finished => {
      if (finished) runOnJS(end)();
    });
  }, [active, fromRect, toRect, tx, ty, scale, end]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  if (!active || !fromRect) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.clone,
          { left: fromRect.x, top: fromRect.y, width: fromRect.width },
          animatedStyle,
        ]}
      >
        <NewCardArt last4={last4} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  clone: { position: 'absolute' },
});

export default CardHeroOverlay;
