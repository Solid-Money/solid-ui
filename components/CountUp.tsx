import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TextStyle, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

const IS_WEB = typeof Platform !== 'undefined' && Platform.OS === 'web';

// Animation tuning
const PHASE_MS = 100;
const KEYFRAME_UP_END = 0.2;
const KEYFRAME_BLUR_END = 0.4;
const KEYFRAME_SWAP = 0.5;
const KEYFRAME_UNBLUR_END = 0.7;
const TRANSLATE_UP = -1.08;
const SCALE_UP = 1.08;
const BLUR_PX = 4;
const OPACITY_SOFT = 0.35;
const STAGGER_MS = 100;

type ClassNames = {
  wrapper?: string;
  decimalSeparator?: string;
};

type Styles = {
  wholeText?: TextStyle;
  decimalText?: TextStyle;
  decimalSeparator?: TextStyle;
  suffixText?: TextStyle;
};

interface AnimatedDigitProps {
  char: string;
  staggerIndex: number;
  style?: TextStyle;
  className?: string;
}

function AnimatedDigit({ char, staggerIndex, style, className }: AnimatedDigitProps) {
  const [displayChar, setDisplayChar] = useState(char);
  const progress = useSharedValue(0);
  const prevCharRef = useRef<string>(char);
  const isFirstRef = useRef(true);

  const setChar = useCallback((c: string) => setDisplayChar(c), []);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      prevCharRef.current = char;
      return;
    }
    if (prevCharRef.current === char) return;

    prevCharRef.current = char;
    const delay = staggerIndex * STAGGER_MS;
    const t = setTimeout(() => {
      progress.value = 0;
      progress.value = withSequence(
        withTiming(KEYFRAME_UP_END, { duration: PHASE_MS }),
        withTiming(KEYFRAME_BLUR_END, { duration: PHASE_MS }),
        withTiming(KEYFRAME_SWAP, { duration: 0 }, finished => {
          if (finished) scheduleOnRN(setChar, char);
        }),
        withTiming(KEYFRAME_UNBLUR_END, { duration: PHASE_MS }),
        withTiming(1, { duration: PHASE_MS }),
      );
    }, delay);
    return () => clearTimeout(t);
  }, [char, staggerIndex, progress, setChar]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    const translateY = interpolate(
      p,
      [0, KEYFRAME_UP_END, KEYFRAME_UNBLUR_END, 1],
      [0, TRANSLATE_UP, TRANSLATE_UP, 0],
    );
    const scale = interpolate(
      p,
      [0, KEYFRAME_UP_END, KEYFRAME_UNBLUR_END, 1],
      [1, SCALE_UP, SCALE_UP, 1],
    );
    const opacity = IS_WEB
      ? 1
      : interpolate(
          p,
          [0, KEYFRAME_UP_END, KEYFRAME_BLUR_END, KEYFRAME_SWAP, KEYFRAME_UNBLUR_END, 1],
          [1, 1, OPACITY_SOFT, OPACITY_SOFT, 1, 1],
        );
    const blurPx = IS_WEB
      ? interpolate(
          p,
          [0, KEYFRAME_UP_END, KEYFRAME_BLUR_END, KEYFRAME_SWAP, KEYFRAME_UNBLUR_END, 1],
          [0, 0, BLUR_PX, BLUR_PX, 0, 0],
        )
      : 0;

    const style: Record<string, unknown> = {
      transform: [{ translateY }, { scale }],
      opacity,
    };
    if (IS_WEB && blurPx > 0) {
      style.filter = `blur(${blurPx}px)`;
    }
    return style as Record<string, unknown>;
  });

  return (
    <Animated.View style={animatedStyle} className={className}>
      <Text style={style}>{displayChar}</Text>
    </Animated.View>
  );
}

interface CountUpProps {
  count: number;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  isTrailingZero?: boolean;
  prefix?: string | React.ReactNode;
  suffix?: string;
}

const CountUp = ({
  count,
  decimalPlaces = 6,
  classNames,
  styles,
  isTrailingZero = true,
  prefix,
  suffix,
}: CountUpProps) => {
  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const wholeStr = wholeNumber.toLocaleString('en-US', { useGrouping: true });
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const decimalStr = isNaN(Number(trailingZero)) ? '0' : (trailingZero ?? '0');

  const wholeChars = wholeStr.split('');
  const decimalChars = decimalStr.split('');
  let wholeStaggerIndex = 0;

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
      {prefix != null ? (
        typeof prefix === 'string' ? (
          <Text style={styles?.wholeText}>{prefix}</Text>
        ) : (
          prefix
        )
      ) : null}
      {wholeChars.map((c, i) =>
        c >= '0' && c <= '9' ? (
          <AnimatedDigit
            key={`whole-${i}`}
            char={c}
            staggerIndex={wholeStaggerIndex++}
            style={styles?.wholeText}
            className={classNames?.decimalSeparator}
          />
        ) : (
          <Text
            key={`whole-${i}-sep`}
            className={classNames?.decimalSeparator}
            style={styles?.wholeText}
          >
            {c}
          </Text>
        ),
      )}
      {decimalPlaces > 0 ? (
        <>
          <Text className={classNames?.decimalSeparator} style={styles?.decimalSeparator}>
            .
          </Text>
          {decimalChars.map((c, i) => (
            <AnimatedDigit
              key={`decimal-${i}`}
              char={c}
              staggerIndex={wholeStaggerIndex + i}
              style={styles?.decimalText}
              className={classNames?.decimalSeparator}
            />
          ))}
        </>
      ) : null}
      {suffix != null ? (
        <Text style={[{ marginLeft: 6 }, styles?.wholeText, styles?.suffixText]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

export default CountUp;
