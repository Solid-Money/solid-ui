import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/text';

import AiApiAgentLogo, { AI_API_AGENT_LOGOS, type AiApiAgentLogoId } from './AiApiAgentLogo';
import { formatAiApiRate } from './aiApiFormat';
import { AI_API_BRAND, AiApiChip } from './AiApiPrimitives';

// Figma node 28710:6927, "Benefit — AI agents (NEW)": a 387 × 88 card with
// the agents' logos floating at its right edge. Positions below are in the
// logos' 150 × 88 frame, which sits 7pt in from the card's right edge.
const LOGOS_FRAME = { width: 150, height: 88, right: 7 };
const GLOW = { left: 0, top: -6, width: 150, height: 100 };

// The copy needs its title row (167pt in Figma) after the 18pt inset, and a
// gap before the logos. The logos beside that row start with Claude Code, 32pt
// into their frame. A card too narrow for both, on a 320pt phone, shrinks the
// logos towards its right edge rather than drawing them over the copy.
const COPY_RESERVED = 18 + 167 + 8;
const LOGOS_FIRST_LEFT = 32;
const MIN_LOGOS_SCALE = 0.6;

const logosScale = (cardWidth: number) => {
  if (cardWidth <= 0) return 1;
  const room = cardWidth - COPY_RESERVED - LOGOS_FRAME.right;
  const needed = LOGOS_FRAME.width - LOGOS_FIRST_LEFT;
  return Math.min(1, Math.max(MIN_LOGOS_SCALE, room / needed));
};

// The card's own wash, an ellipse of radii 116.1 × 88 centred under the logos:
// 309.6pt into Figma's 387pt card, so 77.4pt in from its right edge.
const CARD_GLOW = { rx: 116.1, ry: 88, right: 77.4 };

/** Figma's timeline (cohort of 28710:6865): every track loops every 3.2 seconds. */
const LOOP_MS = 3200;

type Ease = 'in' | 'out' | 'inOut';

/** A keyframe track: a value at each time (0 to 1 of the loop), and the ease into each next one. */
interface Track {
  values: readonly number[];
  times: readonly number[];
  eases: readonly Ease[];
}

// motion's named eases, as Figma exports them.
const EASE_IN = Easing.bezier(0.42, 0, 1, 1).factory();
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1).factory();

/** Out and back over the loop. */
const bob = (by: number): Track => ({
  values: [0, by, 0],
  times: [0, 0.5, 1],
  eases: ['inOut', 'inOut'],
});

/** Starting part-way, so these two drift out of step with the others. */
const drift = (values: readonly [number, number, number, number]): Track => ({
  values,
  times: [0, 0.25, 0.75, 1],
  eases: ['out', 'inOut', 'in'],
});

const GLOW_OPACITY: Track = { values: [1, 0.55, 1], times: [0, 0.5, 1], eases: ['inOut', 'inOut'] };

interface FloatingLogo {
  agent: AiApiAgentLogoId;
  left: number;
  top: number;
  size: number;
  opacity: number;
  /** How far the logo moves down (positive) or up over the loop, in points. */
  y: Track;
}

// Back to front, as Figma stacks them.
const FLOATING_LOGOS: FloatingLogo[] = [
  { agent: 'opencode', left: 6, top: 50, size: 20, opacity: 0.6, y: bob(3) },
  { agent: 'hermes', left: 125, top: 53, size: 22, opacity: 0.7, y: drift([1.5, 3, 0, 1.5]) },
  { agent: 'codex', left: 69, top: 49, size: 26, opacity: 1, y: drift([-2, -4, 0, -2]) },
  { agent: 'openclaw', left: 100, top: 14, size: 28, opacity: 1, y: bob(4) },
  { agent: 'claude-code', left: 32, top: 14, size: 32, opacity: 1, y: bob(-5) },
];

const ease = (kind: Ease, x: number) => {
  'worklet';

  if (kind === 'in') return EASE_IN(x);
  if (kind === 'out') return EASE_OUT(x);
  return EASE_IN_OUT(x);
};

/** A track's value at `t`, 0 to 1 of the loop. */
const sample = (track: Track, t: number) => {
  'worklet';

  const { values, times, eases } = track;
  for (let index = 1; index < times.length; index++) {
    if (t <= times[index]) {
      const from = times[index - 1];
      const span = times[index] - from;
      const local = span > 0 ? Math.min(1, Math.max(0, (t - from) / span)) : 1;
      return (
        values[index - 1] + (values[index] - values[index - 1]) * ease(eases[index - 1], local)
      );
    }
  }
  return values[values.length - 1];
};

const Logo = ({ logo, progress }: { logo: FloatingLogo; progress: SharedValue<number> }) => {
  const agent = AI_API_AGENT_LOGOS.find(entry => entry.id === logo.agent);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sample(logo.y, progress.value) }],
  }));

  if (!agent) return null;
  return (
    <Animated.View
      style={[
        styles.logo,
        {
          left: logo.left,
          top: logo.top,
          width: logo.size,
          height: logo.size,
          borderRadius: logo.size / 2,
          opacity: logo.opacity,
        },
        animatedStyle,
      ]}
    >
      <AiApiAgentLogo agent={agent} size={logo.size} />
    </Animated.View>
  );
};

/** The green glow behind the logos, breathing with the loop. */
const LogosGlow = ({ id, progress }: { id: string; progress: SharedValue<number> }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: sample(GLOW_OPACITY, progress.value),
  }));

  return (
    <Animated.View style={[styles.glow, animatedStyle]}>
      <Svg width={GLOW.width} height={GLOW.height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={AI_API_BRAND} stopOpacity={0.16} />
            <Stop offset="1" stopColor={AI_API_BRAND} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={GLOW.width / 2}
          cy={GLOW.height / 2}
          rx={GLOW.width / 2}
          ry={GLOW.height / 2}
          fill={`url(#${id})`}
        />
      </Svg>
    </Animated.View>
  );
};

/**
 * The agents' logos at the card's right edge, each bobbing on its own track of
 * Figma's loop over a glow that dims and brightens with it. With reduced
 * motion on, everything rests where the loop starts.
 */
const FloatingLogos = ({ id, scale }: { id: string; scale: number }) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!reduceMotion) {
      progress.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1);
    }
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  return (
    <View
      style={[
        styles.logos,
        scale < 1 ? { transform: [{ scale }], transformOrigin: 'right center' } : null,
      ]}
    >
      <LogosGlow id={`${id}-glow`} progress={progress} />
      {FLOATING_LOGOS.map(logo => (
        <Logo key={logo.agent} logo={logo} progress={progress} />
      ))}
    </View>
  );
};

/** The card's faint green wash, centred under the logos. */
const CardGlow = ({ id }: { id: string }) => (
  <View style={styles.cardGlow}>
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={AI_API_BRAND} stopOpacity={0.07} />
          <Stop offset="1" stopColor={AI_API_BRAND} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>
);

/**
 * The AI API's place in "Your tier benefits": a full-width card below the
 * grid, its "New" chip and floating agent logos setting it apart from the
 * tier's standing perks. Every tier gets it, so it is not one of the grid's
 * cards.
 */
const AiApiBenefitCard = ({
  cashbackRate,
  isNew,
  onPress,
}: {
  cashbackRate: number;
  /** Shown until the user has a key — it stops being news once they use it. */
  isNew: boolean;
  onPress: () => void;
}) => {
  const id = `ai-api-benefit-${useId().replace(/:/g, '')}`;
  const rate = formatAiApiRate(cashbackRate);
  const [width, setWidth] = useState(0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rate} cashback${isNew ? ', new' : ''}. To run your AI agents.`}
      onPress={onPress}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      className="min-h-[88px] justify-center overflow-hidden rounded-twice border border-white/5 bg-card px-[18px] py-5 transition-all active:scale-95 active:opacity-80"
    >
      <View
        style={styles.artwork}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <CardGlow id={`${id}-card`} />
        <FloatingLogos id={id} scale={logosScale(width)} />
      </View>
      <View className="max-w-[200px] gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-[16px] font-medium text-white">{rate} cashback</Text>
          {isNew ? <AiApiChip label="New" tone="brand" /> : null}
        </View>
        <Text className="text-[14px] text-white/70">To run your AI agents</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Center the artwork across the whole card, including the copy's padding.
  artwork: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cardGlow: {
    position: 'absolute',
    right: CARD_GLOW.right - CARD_GLOW.rx,
    width: CARD_GLOW.rx * 2,
    height: CARD_GLOW.ry * 2,
  },
  logos: {
    marginRight: LOGOS_FRAME.right,
    width: LOGOS_FRAME.width,
    height: LOGOS_FRAME.height,
  },
  glow: {
    position: 'absolute',
    left: GLOW.left,
    top: GLOW.top,
    width: GLOW.width,
    height: GLOW.height,
  },
  logo: {
    position: 'absolute',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.45)',
  },
});

export default AiApiBenefitCard;
