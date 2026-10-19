import { type ReactNode, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { Text, TextClassOverrideContext } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

import SolidAiAvatar from './SolidAiAvatar';

import type { CardSheetPresentation } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';

const POINTS = [
  {
    source: getAsset('images/support/sparkles.svg'),
    width: 20,
    height: 20,
    label: 'Answers in seconds, 24/7',
  },
  {
    source: getAsset('images/support/users.svg'),
    width: 18.4167,
    height: 16.75,
    label: 'Ask for a person anytime',
  },
  {
    source: getAsset('images/support/shield.svg'),
    width: 15.0833,
    height: 18.4195,
    label: 'Never asks for your passwords',
  },
] as const;
const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1);
const EASE_OUT_BACK = Easing.bezierFn(0.45, 1.45, 0.8, 1);
const IntroTitle = Platform.OS === 'web' ? DialogTitle : Text;

/** One clock preserves Figma's coordinated reveal times across every element. */
function Reveal({
  clock,
  delay,
  opacityDuration = 350,
  duration = 450,
  scaleFrom,
  children,
}: {
  clock: SharedValue<number>;
  delay: number;
  opacityDuration?: number;
  duration?: number;
  scaleFrom?: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const opacityProgress = Math.min(1, Math.max(0, (clock.value - delay) / opacityDuration));
    const progress = Math.min(1, Math.max(0, (clock.value - delay) / duration));
    return {
      opacity: EASE_OUT(opacityProgress),
      transform:
        scaleFrom === undefined
          ? [{ translateY: 14 * (1 - EASE_OUT(progress)) }]
          : [{ scale: scaleFrom + (1 - scaleFrom) * EASE_OUT_BACK(progress) }],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function SupportIntroContent({
  topPadding,
  presentation = 'sheet',
  onClose,
}: {
  topPadding: number;
  presentation?: CardSheetPresentation;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(reduceMotion ? 1600 : 0);
  useEffect(() => {
    clock.value = reduceMotion ? 1600 : withTiming(1600, { duration: 1600, easing: Easing.linear });
    return () => cancelAnimation(clock);
  }, [clock, reduceMotion]);
  return (
    <View
      style={[
        styles.content,
        { paddingTop: topPadding, paddingHorizontal: presentation === 'modal' ? 0 : 24 },
      ]}
    >
      {presentation === 'modal' && (
        <SheetIconButton
          icon="close"
          accessibilityLabel="Close introduction"
          onPress={onClose}
          style={styles.close}
        />
      )}
      <View style={styles.hero}>
        <Reveal clock={clock} delay={350} opacityDuration={250} duration={550} scaleFrom={0.4}>
          <SolidAiAvatar size={88} glow />
        </Reveal>
      </View>
      <View style={styles.gap}>
        <Reveal clock={clock} delay={550}>
          <IntroTitle
            accessibilityRole="header"
            className="text-center text-[30px] font-medium leading-[30px] text-white"
            style={styles.heading}
          >
            Meet Solid AI
          </IntroTitle>
        </Reveal>
      </View>
      <View style={styles.gap}>
        <Reveal clock={clock} delay={650}>
          <Text className="text-center text-base leading-[22px] text-white/70">
            {'Instant answers, day or night.\nThe team is one message away.'}
          </Text>
        </Reveal>
      </View>
      <View style={[styles.gap, styles.card]}>
        {POINTS.map(({ source, width, height, label }, index) => (
          <View key={label}>
            {index > 0 && <View style={styles.divider} />}
            <Reveal clock={clock} delay={800 + index * 100}>
              <View style={styles.row}>
                <View style={styles.icon}>
                  <Image
                    source={source}
                    style={{ width, height }}
                    contentFit="contain"
                    accessible={false}
                  />
                </View>
                <Text
                  className="text-base font-medium leading-[23px] text-white/85"
                  style={styles.point}
                >
                  {label}
                </Text>
              </View>
            </Reveal>
          </View>
        ))}
      </View>
      <View style={styles.gap}>
        <Reveal clock={clock} delay={1150} opacityDuration={300} duration={450} scaleFrom={0.94}>
          <Button
            variant="brand"
            className="w-full rounded-full"
            style={styles.button}
            onPress={onClose}
            accessibilityLabel="Start chatting"
          >
            <TextClassOverrideContext.Provider value="font-bold">
              <Text className="text-base text-black">Start chatting</Text>
            </TextClassOverrideContext.Provider>
          </Button>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
  close: { position: 'absolute', right: 0, top: 0, zIndex: 1 },
  hero: { height: 128, alignItems: 'center', justifyContent: 'center' },
  gap: { marginTop: 22 },
  heading: { lineHeight: 30 },
  card: { backgroundColor: '#2B2B2B', borderRadius: 20, paddingVertical: 4, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    minHeight: 53,
  },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  point: { flexShrink: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  button: { height: 49, minHeight: 49, backgroundColor: '#94F27F' },
});
