import { memo, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

/** The four-point spark at the centre of the avatar (Figma "Avatar / Solid AI"). */
const SPARK_PATH =
  'M12 0c.7 6.2 5.8 11.3 12 12-6.2.7-11.3 5.8-12 12-.7-6.2-5.8-11.3-12-12C6.2 11.3 11.3 6.2 12 0z';

/** Ripples pulse out from the avatar while Solid AI works; the intro sheet uses a calmer pace. */
const RIPPLE = {
  fast: { every: 650, grow: 900, scale: 1.9 },
  slow: { every: 1800, grow: 3200, scale: 1.7 },
} as const;

export type SolidAiRipple = keyof typeof RIPPLE;

interface SolidAiAvatarProps {
  size?: number;
  /** Rings pulsing out of the avatar: `fast` while Solid AI is working, `slow` for the intro. */
  ripple?: SolidAiRipple | null;
  /** The soft green glow around it. Off where the avatar sits on a busy background. */
  glow?: boolean;
}

/** A soft round blob of light: a radial gradient that fades to nothing at its edge. */
const Blob = ({
  id,
  cx,
  cy,
  r,
  stops,
}: {
  id: string;
  cx: string;
  cy: string;
  r: string;
  stops: [offset: string, color: string, opacity: number][];
}) => (
  <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id={id} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
        {stops.map(([offset, color, opacity]) => (
          <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
        ))}
      </RadialGradient>
    </Defs>
    <Circle cx="50" cy="50" r="75" fill={`url(#${id})`} />
  </Svg>
);

/** One orbit of light: a blob turning around the centre at its own pace. */
const Orbit = ({
  duration,
  reverse,
  still,
  children,
}: {
  duration: number;
  reverse?: boolean;
  still: boolean;
  children: React.ReactNode;
}) => {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [duration, still, turn]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * turn.value * 360}deg` }],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
};

/** A ring that grows out of the avatar and fades, again and again. */
const Ring = ({
  size,
  delay,
  pace,
}: {
  size: number;
  delay: number;
  pace: (typeof RIPPLE)[SolidAiRipple];
}) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    // Each ring repeats on the pair's period, so the two stay evenly spaced.
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: pace.every * 2, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, pace, progress]);
  const growShare = Math.min(1, pace.grow / (pace.every * 2));
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, progress.value / growShare);
    const eased = 1 - (1 - t) * (1 - t);
    return {
      opacity: progress.value === 0 ? 0 : interpolate(eased, [0, 1], [0.6, 0]),
      transform: [{ scale: interpolate(eased, [0, 1], [1, pace.scale]) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: size / 2,
          borderWidth: Math.max(1, size / 60),
          borderColor: '#94F27F',
        },
        style,
      ]}
    />
  );
};

/**
 * Solid AI's avatar: frosted glass over a slowly moving green light, with a
 * white spark. The light keeps moving (two blobs orbiting at different paces);
 * with Reduce Motion on it holds still and the ripples are skipped.
 */
function SolidAiAvatar({ size = 28, ripple = null, glow = true }: SolidAiAvatarProps) {
  const reduceMotion = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spark = size * 0.32;
  const pace = ripple && !reduceMotion ? RIPPLE[ripple] : null;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Solid AI"
    >
      {glow && (
        <Svg
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -size * 0.35,
            top: -size * 0.35,
            width: size * 1.7,
            height: size * 1.7,
          }}
          viewBox="0 0 100 100"
        >
          <Defs>
            <RadialGradient id={`${id}glow`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0.5" stopColor="#94F27F" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#94F27F" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill={`url(#${id}glow)`} />
        </Svg>
      )}
      {pace && (
        <>
          <Ring size={size} delay={0} pace={pace} />
          <Ring size={size} delay={pace.every} pace={pace} />
        </>
      )}

      <View style={[styles.core, { borderRadius: size / 2 }]}>
        <Blob
          id={`${id}base`}
          cx="40"
          cy="65"
          r="80"
          stops={[
            ['0', '#1d5a27', 1],
            ['1', '#08170b', 1],
          ]}
        />
        <Orbit duration={9000} still={reduceMotion}>
          <Blob
            id={`${id}a`}
            cx="30"
            cy="72"
            r="55"
            stops={[
              ['0', '#94F27F', 0.95],
              ['0.5', '#5fca62', 0.6],
              ['1', '#5fca62', 0],
            ]}
          />
        </Orbit>
        <Orbit duration={14000} reverse still={reduceMotion}>
          <Blob
            id={`${id}b`}
            cx="74"
            cy="28"
            r="42"
            stops={[
              ['0', '#c9ffb8', 0.55],
              ['1', '#c9ffb8', 0],
            ]}
          />
        </Orbit>
        <Orbit duration={21000} still={reduceMotion}>
          <Blob
            id={`${id}c`}
            cx="72"
            cy="78"
            r="40"
            stops={[
              ['0', '#08170b', 0.65],
              ['1', '#08170b', 0],
            ]}
          />
        </Orbit>
        {/* Glass: a soft highlight from the top left, a little shade bottom right. */}
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.38, 0.62]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.7, y: 0.85 }}
        />
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']}
          start={{ x: 0.45, y: 0.45 }}
          end={{ x: 1, y: 1 }}
        />
        <Svg
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (size - spark * 2) / 2,
            top: (size - spark * 2) / 2,
            width: spark * 2,
            height: spark * 2,
          }}
          viewBox="0 0 100 100"
        >
          <Defs>
            <RadialGradient id={`${id}spark`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill={`url(#${id}spark)`} />
        </Svg>
        <Svg
          pointerEvents="none"
          width={spark}
          height={spark}
          viewBox="0 0 24 24"
          style={{ position: 'absolute', left: (size - spark) / 2, top: (size - spark) / 2 }}
        >
          <Path d={SPARK_PATH} fill="#FFFFFF" fillOpacity={0.96} />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: size / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#0a160c',
  },
  rim: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});

export default memo(SolidAiAvatar);
