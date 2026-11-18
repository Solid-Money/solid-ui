import { type ReactNode, useEffect, useId, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { type AssetPath, getAsset } from '@/lib/assets';

import { AI_API_BRAND } from './AiApiPrimitives';

// Figma node 29632:13369, "Illustration — agents orbit". Positions are in its
// 387 × 210 frame; a narrower card scales the whole frame down.
const ORBIT_WIDTH = 387;
const ORBIT_HEIGHT = 210;
// The glow, every ring, the agent coin and the model coins' orbit share this centre.
const CENTER_X = 193.5;
const CENTER_Y = 106;

/** Contour rings, innermost first. Each fades out towards the edge of one shared ellipse. */
const RINGS = [
  { r: 56, opacity: 0.3 },
  // The ring the model coins travel along.
  { r: 80, opacity: 0.28 },
  { r: 114, opacity: 0.2 },
  { r: 142, opacity: 0.15 },
  { r: 170, opacity: 0.14 },
  { r: 204, opacity: 0.09 },
  { r: 240, opacity: 0.07 },
];
const RING_FADE = { rx: 220, ry: 115 };
const INNER_RINGS = [
  { r: 33.5, opacity: 0.3 },
  { r: 21.5, opacity: 0.35 },
];
const SIGNAL_DOTS = [
  { cx: 60.06, cy: 57.43 },
  { cx: 322.2, cy: 45.99 },
  { cx: 60.06, cy: 154.57 },
  { cx: 296.82, cy: 154.18 },
];
// The glow reaches past the frame's bottom, under the copy; the rings fade out
// before the ellipse's edge.
const BACKDROP = { left: CENTER_X - RING_FADE.rx, width: RING_FADE.rx * 2, height: 250 };

interface ModelCoin {
  name: string;
  left: number;
  top: number;
  backgroundColor?: string;
  logo: AssetPath;
  logoSize: number;
  /** Where on the entrance timeline the coin starts to appear. */
  start: number;
}

/** Every model coin's size: they all ride the 80pt ring, a fifth of a turn apart. */
const COIN_SIZE = 40;

// The makers of the launch models, where Figma's frame puts them at the start
// of the orbit.
const MODEL_COINS: ModelCoin[] = [
  {
    name: 'Kimi',
    left: 97.42,
    top: 61.28,
    backgroundColor: 'rgba(11, 11, 11, 0.85)',
    logo: 'images/ai-api/model-kimi.svg',
    logoSize: 19,
    start: 0.14875,
  },
  {
    name: 'Claude',
    left: 173.5,
    top: 6,
    backgroundColor: 'rgba(217, 119, 87, 0.8)',
    logo: 'images/ai-api/model-claude.svg',
    logoSize: 27.273,
    start: 0.14875,
  },
  {
    name: 'OpenAI',
    left: 126.48,
    top: 150.72,
    // Figma exports this coin whole, its fill included.
    logo: 'images/ai-api/model-openai.svg',
    logoSize: COIN_SIZE,
    start: 0.07,
  },
  {
    name: 'GLM',
    left: 220.52,
    top: 150.72,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    logo: 'images/ai-api/model-glm.svg',
    logoSize: 19,
    start: 0.11625,
  },
  {
    name: 'DeepSeek',
    left: 249.58,
    top: 61.28,
    backgroundColor: 'rgba(77, 107, 254, 0.85)',
    logo: 'images/ai-api/model-deepseek.svg',
    logoSize: 24.348,
    start: 0.14875,
  },
];

const AGENT_COIN = { left: 151.5, top: 64, size: 84, start: 0.14875 };

// Lucide's bot, the glyph Figma uses, drawn here so it can carry the design's glow.
const BOT_PATHS = [
  'M12 8V4H8',
  'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
  'M2 14h2',
  'M20 14h2',
  'M15 13v2',
  'M9 13v2',
];
const BOT_SIZE = 40;
// Figma's 2.1875px stroke and 5px glow, in the glyph's 24-unit box.
const BOT_STROKE = 1.3125;
const BOT_GLOW_DEVIATION = 1.5;

// Figma's timeline (cohort of 28710:7027): every coin fades in and springs from
// 55% to full size, then the model coins circle the agent clockwise, one turn
// every 24 seconds. The entrance plays once: Figma's loop restarts it from
// nothing each turn, which would blink every coin out every 24 seconds.
const TIMELINE_DURATION_MS = 2000;
const ORBIT_PERIOD_MS = 24000;
const OPACITY_SPAN = 0.21;
const SCALE_SPAN = 0.275;
const SCALE_FROM = 0.55;
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();

// The spring Figma exports as a CSS linear() easing, sampled as it gives it.
const SPRING_SAMPLES = [
  0, 0.0188, 0.0679, 0.1374, 0.2195, 0.308, 0.3978, 0.4856, 0.5686, 0.6452, 0.7142, 0.7753, 0.8283,
  0.8735, 0.9113, 0.9423, 0.9671, 0.9866, 1.0014, 1.0123, 1.0198, 1.0247, 1.0274, 1.0283, 1.0281,
  1.0268, 1.025, 1.0227, 1.0202, 1.0177, 1.0152, 1.0128, 1.0106, 1.0085, 1.0068, 1.0052, 1.0039,
  1.0028, 1.0018, 1.0011, 1.0005, 1, 0.9997, 0.9995, 0.9993, 0.9992, 0.9992, 0.9992, 0.9992, 0.9993,
  0.9993,
];
const SPRING_INPUT_RANGE = SPRING_SAMPLES.map((_, index) => index / (SPRING_SAMPLES.length - 1));

const getPhase = (progress: number, start: number, end: number) => {
  'worklet';

  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
};

const spring = (phase: number) => {
  'worklet';

  return phase >= 1
    ? 1
    : interpolate(phase, SPRING_INPUT_RANGE, SPRING_SAMPLES, Extrapolation.CLAMP);
};

const Coin = ({
  progress,
  orbit,
  start,
  offset,
  style,
  children,
}: {
  progress: SharedValue<number>;
  /** How far round the orbit the coins are, 0 to 1 a turn. */
  orbit: SharedValue<number>;
  start: number;
  /**
   * The coin's centre from the orbit's centre in Figma's frame. Omitted for the
   * agent coin, which sits on the centre and so never moves.
   */
  offset?: { dx: number; dy: number };
  style: ViewStyle;
  children: ReactNode;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Turning the coin's offset clockwise (y points down) about the centre, and
    // moving it by the difference: Figma's translate keyframes trace the same circle.
    const angle = orbit.value * 2 * Math.PI;
    const dx = offset?.dx ?? 0;
    const dy = offset?.dy ?? 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      opacity: EASE_OUT(getPhase(progress.value, start, start + OPACITY_SPAN)),
      transform: [
        { translateX: dx * cos - dy * sin - dx },
        { translateY: dx * sin + dy * cos - dy },
        {
          scale:
            SCALE_FROM +
            (1 - SCALE_FROM) * spring(getPhase(progress.value, start, start + SCALE_SPAN)),
        },
      ],
    };
  });

  return <Animated.View style={[styles.coin, style, animatedStyle]}>{children}</Animated.View>;
};

/** The glow, the contour rings fading out from the centre, and the signal dots. */
const Backdrop = ({ id }: { id: string }) => (
  <Svg
    width={BACKDROP.width}
    height={BACKDROP.height}
    viewBox={`${BACKDROP.left} 0 ${BACKDROP.width} ${BACKDROP.height}`}
    style={{ position: 'absolute', left: BACKDROP.left, top: 0 }}
  >
    <Defs>
      <RadialGradient
        id={`${id}-glow`}
        cx={CENTER_X}
        cy={CENTER_Y}
        r={150}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset="0" stopColor={AI_API_BRAND} stopOpacity={0.32} />
        <Stop offset="1" stopColor={AI_API_BRAND} stopOpacity={0} />
      </RadialGradient>
      {/* Figma masks each ring with this ellipse: solid to 40%, then gone by its edge. */}
      <RadialGradient
        id={`${id}-ring`}
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform={`translate(${CENTER_X} ${CENTER_Y}) scale(${RING_FADE.rx} ${RING_FADE.ry})`}
      >
        <Stop offset="0" stopColor={AI_API_BRAND} stopOpacity={1} />
        <Stop offset="0.4" stopColor={AI_API_BRAND} stopOpacity={1} />
        <Stop offset="1" stopColor={AI_API_BRAND} stopOpacity={0} />
      </RadialGradient>
      <Filter id={`${id}-dot`} x="-120%" y="-120%" width="340%" height="340%">
        <FeGaussianBlur stdDeviation={3} />
      </Filter>
    </Defs>
    <Circle cx={CENTER_X} cy={CENTER_Y} r={150} fill={`url(#${id}-glow)`} />
    {RINGS.map(ring => (
      <Circle
        key={ring.r}
        cx={CENTER_X}
        cy={CENTER_Y}
        r={ring.r}
        fill="none"
        stroke={`url(#${id}-ring)`}
        strokeOpacity={ring.opacity}
      />
    ))}
    {INNER_RINGS.map(ring => (
      <Circle
        key={ring.r}
        cx={CENTER_X}
        cy={CENTER_Y}
        r={ring.r}
        fill="none"
        stroke={AI_API_BRAND}
        strokeOpacity={ring.opacity}
      />
    ))}
    {SIGNAL_DOTS.map(dot => (
      <Circle
        key={`${dot.cx}-glow`}
        cx={dot.cx}
        cy={dot.cy}
        r={2.5}
        fill={AI_API_BRAND}
        fillOpacity={0.8}
        filter={`url(#${id}-dot)`}
      />
    ))}
    {SIGNAL_DOTS.map(dot => (
      <Circle key={dot.cx} cx={dot.cx} cy={dot.cy} r={2.5} fill={AI_API_BRAND} />
    ))}
  </Svg>
);

const BotGlyph = ({ id }: { id: string }) => (
  <Svg
    width={BOT_SIZE}
    height={BOT_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    style={{ overflow: 'visible' }}
  >
    <Defs>
      {/* In user space: the glyph's straight strokes have no height to scale a box by. */}
      <Filter id={`${id}-bot`} filterUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
        <FeGaussianBlur stdDeviation={BOT_GLOW_DEVIATION} />
      </Filter>
    </Defs>
    {BOT_PATHS.map(d => (
      <Path
        key={`${d}-glow`}
        d={d}
        fill="none"
        stroke={AI_API_BRAND}
        strokeOpacity={0.7}
        strokeWidth={BOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id}-bot)`}
      />
    ))}
    {BOT_PATHS.map(d => (
      <Path
        key={d}
        d={d}
        fill="none"
        stroke={AI_API_BRAND}
        strokeWidth={BOT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))}
  </Svg>
);

/**
 * The intro hero's illustration: the user's agent at the centre of the rings,
 * the models it can reach circling it, coming in on Figma's entrance. With
 * reduced motion on, everything rests where Figma's frame draws it.
 */
const AiApiHeroOrbit = () => {
  const id = `ai-api-orbit-${useId().replace(/:/g, '')}`;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const orbit = useSharedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(orbit);
    progress.value = reduceMotion ? 1 : 0;
    orbit.value = 0;

    if (!reduceMotion) {
      progress.value = withTiming(1, {
        duration: TIMELINE_DURATION_MS,
        easing: Easing.linear,
      });
      orbit.value = withRepeat(
        withTiming(1, { duration: ORBIT_PERIOD_MS, easing: Easing.linear }),
        -1,
      );
    }

    return () => {
      cancelAnimation(progress);
      cancelAnimation(orbit);
    };
  }, [orbit, progress, reduceMotion]);

  const scale = width > 0 ? Math.min(1, width / ORBIT_WIDTH) : 1;

  return (
    <View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={{ width: '100%', height: ORBIT_HEIGHT * scale }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: (width - ORBIT_WIDTH) / 2,
            width: ORBIT_WIDTH,
            height: ORBIT_HEIGHT,
            // Scale about the top edge, so the frame stays flush with the card's.
            transform: [{ translateY: (-ORBIT_HEIGHT * (1 - scale)) / 2 }, { scale }],
          }}
        >
          <Backdrop id={id} />
          {MODEL_COINS.map(coin => (
            <Coin
              key={coin.name}
              progress={progress}
              orbit={orbit}
              start={coin.start}
              offset={{
                dx: coin.left + COIN_SIZE / 2 - CENTER_X,
                dy: coin.top + COIN_SIZE / 2 - CENTER_Y,
              }}
              style={{
                left: coin.left,
                top: coin.top,
                width: COIN_SIZE,
                height: COIN_SIZE,
                borderRadius: COIN_SIZE / 2,
                backgroundColor: coin.backgroundColor,
              }}
            >
              <Image
                source={getAsset(coin.logo)}
                style={{ width: coin.logoSize, height: coin.logoSize }}
                contentFit="contain"
              />
            </Coin>
          ))}
          <Coin
            progress={progress}
            orbit={orbit}
            start={AGENT_COIN.start}
            style={{
              left: AGENT_COIN.left,
              top: AGENT_COIN.top,
              width: AGENT_COIN.size,
              height: AGENT_COIN.size,
              borderRadius: AGENT_COIN.size / 2,
              boxShadow: '0px 0px 36px rgba(148, 242, 127, 0.35)',
            }}
          >
            {/* Clipped inside, so the coin's own glow is never cut by its rounding. */}
            <View style={styles.agentGlass}>
              <LinearGradient
                colors={[
                  'rgba(255, 255, 255, 0.28)',
                  'rgba(255, 255, 255, 0.04)',
                  'rgba(255, 255, 255, 0)',
                ]}
                locations={[0.14286, 0.46429, 0.85714]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <BotGlyph id={id} />
            </View>
          </Coin>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  coin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentGlass: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: AGENT_COIN.size / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(148, 242, 127, 0.16)',
  },
});

export default AiApiHeroOrbit;
