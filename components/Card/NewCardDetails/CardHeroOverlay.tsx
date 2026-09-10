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

  const progress = useSharedValue(0);

  useEffect(() => {
    // Reset while the overlay is hidden as well as when a flight starts.
    progress.value = 0;
    if (!active || !fromRect) return;

    if (!toRect) {
      const timer = setTimeout(() => end(), FALLBACK_MS);
      return () => clearTimeout(timer);
    }

    // Completion belongs to the flight, not its scale: equal-width cards have
    // scale 1 -> 1, which native Reanimated completes immediately, before moving.
    progress.value = withTiming(1, TIMING, finished => {
      if (finished) runOnJS(end)();
    });
  }, [active, fromRect, toRect, progress, end]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!fromRect || !toRect) return {};
    const dx = toRect.x + toRect.width / 2 - (fromRect.x + fromRect.width / 2);
    const dy = toRect.y + toRect.height / 2 - (fromRect.y + fromRect.height / 2);
    return {
      transform: [
        { translateX: dx * progress.value },
        { translateY: dy * progress.value },
        { scale: 1 + (toRect.width / fromRect.width - 1) * progress.value },
      ],
    };
  });

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
