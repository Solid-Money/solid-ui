import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, FeGaussianBlur, Filter, G, Path } from 'react-native-svg';

// Artwork and timing from Figma's card bonus illustration (31369:16505).
const CARD_PATH =
  'M63 1H11C5.47715 1 1 5.47715 1 11V35C1 40.5228 5.47715 45 11 45H63C68.5229 45 73 40.5228 73 35V11C73 5.47715 68.5229 1 63 1Z';
const RIBBON_PATH = 'M1 1V45';
const SHINE_PATH = 'M1 11V5C1 2.8 2.8 1 5 1H13';
const SHINE_LENGTH = 20.3;
const BOW_PATHS = [
  'M23.833 17.9555C18.833 7.45552 8.33299 6.45552 9.03299 13.5555C9.43299 17.5555 16.833 18.3555 23.833 17.9555Z',
  'M23.833 17.9555C28.833 7.45552 39.333 6.45552 38.633 13.5555C38.233 17.5555 30.833 18.3555 23.833 17.9555Z',
];

const DURATION_MS = 2000;
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1).factory();
const IS_WEB = Platform.OS === 'web';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedBlur = Animated.createAnimatedComponent(FeGaussianBlur);

const phase = (timeline: number, start: number, end: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (timeline - start) / (end - start)));
};

const bowSpring = (t: number) => {
  'worklet';
  if (t === 1) return 1;
  return 1 - Math.exp(-t * 7.3635) * (Math.cos(t * 12.754) + 0.5774 * Math.sin(t * 12.754));
};

const styles = StyleSheet.create({
  illustration: { width: 84, height: 62 },
  card: { position: 'absolute', left: 4, top: 18, width: 72, height: 44 },
  cardSvg: { position: 'absolute', left: -9, top: -9 },
  bow: { position: 'absolute', left: 43.167, top: 9.047, width: 29.666, height: 9.0478 },
  bowSvg: { position: 'absolute', left: -9, top: -9 },
});

const CardCreditIllustration = ({ isOpen }: { isOpen: boolean }) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion || !isOpen ? 1 : 0);

  useEffect(() => {
    if (!isOpen || reduceMotion) return;

    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear });

    return () => cancelAnimation(progress);
  }, [isOpen, progress, reduceMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: EASE_OUT(phase(progress.value, 0.025, 0.2)),
    transform: [{ translateY: 8 * (1 - EASE_OUT(phase(progress.value, 0.025, 0.275))) }],
  }));
  const glowProps = useAnimatedProps<{
    stdDeviation: number;
    stdDeviationX?: number;
    stdDeviationY?: number;
  }>(() => {
    const stdDeviation = 4 * EASE_OUT(phase(progress.value, 0.1, 0.35));
    // Reanimated updates the native SVG view directly, bypassing its prop conversion.
    return IS_WEB
      ? { stdDeviation }
      : { stdDeviation, stdDeviationX: stdDeviation, stdDeviationY: stdDeviation };
  });
  const shineProps = useAnimatedProps(() => {
    const drawn = EASE_IN_OUT(phase(progress.value, 0.275, 0.475));
    return { opacity: drawn > 0 ? 1 : 0, strokeDashoffset: SHINE_LENGTH * (1 - drawn) };
  });
  const bowStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const rotation =
      10 * EASE_OUT(phase(t, 0.375, 0.45)) -
      17 * EASE_IN_OUT(phase(t, 0.45, 0.525)) +
      7 * EASE_OUT(phase(t, 0.525, 0.625));
    return {
      opacity: EASE_OUT(phase(t, 0.15, 0.2)),
      transform: [
        { rotate: `${rotation}deg` },
        { scale: 0.2 + 0.8 * bowSpring(phase(t, 0.15, 0.375)) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={styles.illustration}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Svg width={90} height={62} viewBox="-9 -9 90 62" style={styles.cardSvg}>
          <Defs>
            <Filter id="cardCreditGlow" x="-20%" y="-30%" width="140%" height="160%">
              <AnimatedBlur animatedProps={glowProps} />
            </Filter>
          </Defs>
          <G
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <G transform="translate(-1 -1)">
              <Path d={CARD_PATH} fill="white" opacity={0.5} filter="url(#cardCreditGlow)" />
              <Path d={CARD_PATH} fill="#101010" />
            </G>
            <Path d={RIBBON_PATH} transform="translate(53 -1)" />
            <AnimatedPath
              d={SHINE_PATH}
              transform="translate(7 6)"
              strokeDasharray={[SHINE_LENGTH, SHINE_LENGTH]}
              animatedProps={shineProps}
            />
          </G>
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.bow, bowStyle]}>
        <Svg width={47.666} height={27.0478} viewBox="0 0 47.666 27.0478" style={styles.bowSvg}>
          <Defs>
            <Filter id="cardCreditBowGlow" x="-40%" y="-120%" width="180%" height="340%">
              <FeGaussianBlur stdDeviation={4} />
            </Filter>
          </Defs>
          <G stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <G fill="white" opacity={0.5} filter="url(#cardCreditBowGlow)">
              {BOW_PATHS.map(d => (
                <Path key={d} d={d} />
              ))}
            </G>
            <G fill="#101010">
              {BOW_PATHS.map(d => (
                <Path key={d} d={d} />
              ))}
            </G>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
};

export default CardCreditIllustration;
