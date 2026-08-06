import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useCardPaneStore } from '@/store/useCardPaneStore';

/**
 * Motion spec for the home → card-details transition, transcribed 1:1 from the
 * Figma animation frame (node 20048:3312, 2s loop). Percentages there are
 * converted to ms (×20) and the two easing curves map to:
 *
 *   cubic-bezier(0.22, 1, 0.36, 1) → EASE_OUT_QUINT (opacity + small transforms)
 *   cubic-bezier(0.16, 1, 0.3, 1)  → EASE_OUT_EXPO  (the card flight + panel slides)
 *
 * The card itself is not listed here: it is flown by <CardHeroOverlay/>, which
 * derives its translate/scale from the measured source and destination rects (the
 * design's -244px / 0.985→1 fall out of that automatically).
 */
export const EASE_OUT_QUINT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

/** Card flight: Figma `20048:3338` — 0 → 31% of the 2s timeline. */
export const CARD_FLIGHT_DURATION = 620;

/**
 * Dismissal reuses each section's own duration but drops the arrival stagger — the
 * design only specifies the opening, and a dismissal reads better when it's
 * immediate rather than rippling back out.
 */
const CLOSE_DELAY = 0;

export interface HeroExitSpec {
  /** Fade-out duration (ms). */
  fade: number;
  /** Duration of the transform leg (ms). */
  transform: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
}

export interface HeroEnterSpec {
  /** Offset from the tap before this section starts animating (ms). */
  delay: number;
  /** Fade-in duration (ms). */
  fade: number;
  /** Duration of the transform leg (ms). */
  transform: number;
  /** Starting Y offset, animated to 0. */
  translateY?: number;
  /** Starting scale, animated to 1. */
  scale?: number;
}

/** Home-screen elements leaving (all start at the tap). */
export const HERO_EXIT = {
  /** Figma 20048:3316 — the circular header button on the left. */
  headerLeft: { fade: 280, transform: 300, scale: 0.88 },
  /** Figma 20048:3321 — the circular header button on the right. */
  headerRight: { fade: 260, transform: 300, translateX: 12 },
  /** Figma 20081:2568/2569/2570 — balance label, amount and the balances pill. */
  balance: { fade: 220, transform: 240, translateY: -12 },
  /** Figma 20081:2576 — the wallet action buttons. */
  actions: { fade: 340, transform: 380, translateY: -8 },
  /** Figma 20048:3453 — the section directly below the card. */
  belowCard: { fade: 420, transform: 460, translateY: -18 },
} satisfies Record<string, HeroExitSpec>;

/** Card-details sections arriving, staggered. */
export const HERO_ENTER = {
  /** Figma 21903:875 — the "Show details" panel tucked behind the card. */
  showDetails: { delay: 80, fade: 420, transform: 600, translateY: 356 },
  /** Figma 21903:887 — the back button. */
  back: { delay: 180, fade: 280, transform: 300, scale: 0.88 },
  /** Figma 21903:896 — the "Solid card" title. */
  title: { delay: 180, fade: 280, transform: 300, translateY: 10 },
  /** Figma 21903:903 — the Add funds / Freeze / Settings row. */
  actions: { delay: 300, fade: 320, transform: 360, translateY: 24 },
  /** Figma 21903:936 — the cashback card. */
  cashback: { delay: 400, fade: 320, transform: 360, translateY: 28 },
  /** Figma 21903:950 — the transactions / rewards / support list. */
  links: { delay: 480, fade: 340, transform: 380, translateY: 34 },
} satisfies Record<string, HeroEnterSpec>;

interface HeroMotionProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * A card-details section arriving. Because the pane is state on the wallet screen
 * rather than a screen of its own, this is driven straight off the open flag: the
 * whole tree is already mounted, so the stagger starts on the frame of the tap
 * with nothing to wait for. Closing runs it in reverse.
 */
export const HeroEnter = ({
  spec,
  children,
  style,
  className,
}: HeroMotionProps & { spec: HeroEnterSpec }) => {
  const isOpen = useCardPaneStore(state => state.isOpen);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = isOpen ? spec.delay : CLOSE_DELAY;
    const to = isOpen ? 1 : 0;
    opacity.value = withDelay(
      delay,
      withTiming(to, { duration: spec.fade, easing: EASE_OUT_QUINT }),
    );
    progress.value = withDelay(
      delay,
      withTiming(to, { duration: spec.transform, easing: EASE_OUT_EXPO }),
    );
  }, [isOpen, spec, opacity, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const remaining = 1 - progress.value;
    const transform = [];
    if (spec.translateY) transform.push({ translateY: remaining * spec.translateY });
    if (spec.scale !== undefined) transform.push({ scale: 1 - remaining * (1 - spec.scale) });
    return { opacity: opacity.value, transform };
  });

  return (
    <Animated.View className={className} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

/**
 * A wallet-screen element getting out of the way while the pane is open, and coming
 * back when it closes. It has to key off the pane rather than the card's flight:
 * the pane draws over this screen with no background of its own, so anything that
 * came back at the end of the flight would show through it.
 */
export const HeroExit = ({
  spec,
  children,
  style,
  className,
}: HeroMotionProps & { spec: HeroExitSpec }) => {
  const isOpen = useCardPaneStore(state => state.isOpen);
  const opacity = useSharedValue(1);
  const progress = useSharedValue(1);

  useEffect(() => {
    const to = isOpen ? 0 : 1;
    opacity.value = withTiming(to, { duration: spec.fade, easing: Easing.out(Easing.ease) });
    progress.value = withTiming(to, { duration: spec.transform, easing: EASE_OUT_QUINT });
  }, [isOpen, opacity, progress, spec]);

  const animatedStyle = useAnimatedStyle(() => {
    const remaining = 1 - progress.value;
    const transform = [];
    if (spec.translateX) transform.push({ translateX: remaining * spec.translateX });
    if (spec.translateY) transform.push({ translateY: remaining * spec.translateY });
    if (spec.scale !== undefined) transform.push({ scale: 1 - remaining * (1 - spec.scale) });
    return { opacity: opacity.value, transform };
  });

  return (
    // Untouchable once it's out of the way: these elements only fade, so without this
    // an invisible wallet header button would still take taps aimed at the pane.
    <Animated.View
      className={className}
      pointerEvents={isOpen ? 'none' : 'auto'}
      style={[style, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
};
