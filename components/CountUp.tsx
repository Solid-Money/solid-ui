import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, TextStyle, View } from 'react-native';
import { AnimatedRollingNumber } from 'react-native-animated-rolling-numbers';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

// Android can draw white boxes when custom font + fontWeight are both set, or when
// AnimatedRollingNumber first paints with height=0 (digits stacked). Normalize styles
// and delay rolling on Android to avoid the flash.
function textStyleForAndroid(style?: TextStyle): TextStyle | undefined {
  if (Platform.OS !== 'android' || !style) return style;
  const { fontWeight: _, ...rest } = style;
  return Object.keys(rest).length ? rest : style;
}

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

interface CountUpProps {
  count: number;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  isTrailingZero?: boolean;
  prefix?: string | React.ReactNode;
  suffix?: string;
  animated?: boolean;
  animateOnMount?: boolean;
}

const DURATION = 500;

const CountUp = ({
  count,
  decimalPlaces = 6,
  classNames,
  styles,
  isTrailingZero = true,
  prefix,
  suffix,
  animated = true,
  animateOnMount = true,
}: CountUpProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [canAnimateAfterMount, setCanAnimateAfterMount] = useState(animateOnMount);
  const [hasSwitchedToRolling, setHasSwitchedToRolling] = useState(animateOnMount);
  // On Android, delay arming AnimatedRollingNumber so we don't paint it with height=0
  // (stacked digits → white blob).
  const [useRolling, setUseRolling] = useState(
    animated && animateOnMount && Platform.OS !== 'android',
  );
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    if (!animated) {
      setUseRolling(false);
      return;
    }
    if (Platform.OS !== 'android') {
      setUseRolling(true);
      return;
    }
    if (isMounted) {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setUseRolling(true));
      });
      return () => cancelAnimationFrame(t);
    }
  }, [animated, isMounted]);

  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const formattedText = isNaN(Number(trailingZero)) ? '0' : trailingZero;

  const formattedWhole = wholeNumber.toLocaleString('en-US');
  const displayKey = `${formattedWhole}.${formattedText}`;
  const initialDisplayKeyRef = useRef(displayKey);

  const wholeStyle = useMemo(
    () => (Platform.OS === 'android' ? textStyleForAndroid(styles?.wholeText) : styles?.wholeText),
    [styles?.wholeText],
  );
  const decimalStyle = useMemo(
    () =>
      Platform.OS === 'android' ? textStyleForAndroid(styles?.decimalText) : styles?.decimalText,
    [styles?.decimalText],
  );

  useEffect(() => {
    if (!animated || animateOnMount || canAnimateAfterMount) return;
    const t = requestAnimationFrame(() => setCanAnimateAfterMount(true));
    return () => cancelAnimationFrame(t);
  }, [animated, animateOnMount, canAnimateAfterMount]);

  const hasChangedSinceInitial = displayKey !== initialDisplayKeyRef.current;
  const showRolling =
    animated &&
    isMounted &&
    useRolling &&
    (animateOnMount || hasSwitchedToRolling || (canAnimateAfterMount && hasChangedSinceInitial));

  useEffect(() => {
    if (showRolling && !hasSwitchedToRolling) {
      setHasSwitchedToRolling(true);
    }
  }, [showRolling, hasSwitchedToRolling]);

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
      {prefix ? (
        typeof prefix === 'string' ? (
          <Text style={wholeStyle}>{prefix}</Text>
        ) : (
          prefix
        )
      ) : null}
      {!showRolling ? <Text style={wholeStyle}>{formattedWhole}</Text> : null}
      {animated ? (
        <AnimatedRollingNumber
          value={wholeNumber}
          containerStyle={showRolling ? undefined : countUpStyles.hiddenRollingNumber}
          textStyle={wholeStyle}
          spinningAnimationConfig={{ duration: DURATION }}
          useGrouping
        />
      ) : null}
      {decimalPlaces > 0 ? (
        <>
          <Text className={classNames?.decimalSeparator} style={styles?.decimalSeparator}>
            .
          </Text>
          {!showRolling ? <Text style={decimalStyle}>{formattedText}</Text> : null}
          {animated ? (
            <AnimatedRollingNumber
              value={Number(formattedText)}
              formattedText={formattedText}
              containerStyle={showRolling ? undefined : countUpStyles.hiddenRollingNumber}
              textStyle={decimalStyle}
              spinningAnimationConfig={{ duration: DURATION }}
            />
          ) : null}
        </>
      ) : null}
      {suffix ? (
        <Text style={[{ marginLeft: 6 }, wholeStyle, styles?.suffixText]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

const countUpStyles = StyleSheet.create({
  hiddenRollingNumber: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
});

export default CountUp;
