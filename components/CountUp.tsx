import React, { useEffect, useMemo, useState } from 'react';
import { Platform, TextStyle, View } from 'react-native';
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
}: CountUpProps) => {
  const [isMounted, setIsMounted] = useState(false);
  // On Android, delay showing AnimatedRollingNumber so we don't paint it with height=0
  // (stacked digits → white blob). Show static text for one frame then switch.
  const [useRolling, setUseRolling] = useState(Platform.OS !== 'android');
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    if (Platform.OS === 'android' && isMounted) {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setUseRolling(true));
      });
      return () => cancelAnimationFrame(t);
    }
  }, [isMounted]);

  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const formattedText = isNaN(Number(trailingZero)) ? '0' : trailingZero;

  const formattedWhole = wholeNumber.toLocaleString('en-US');

  const wholeStyle = useMemo(
    () => (Platform.OS === 'android' ? textStyleForAndroid(styles?.wholeText) : styles?.wholeText),
    [styles?.wholeText],
  );
  const decimalStyle = useMemo(
    () =>
      Platform.OS === 'android' ? textStyleForAndroid(styles?.decimalText) : styles?.decimalText,
    [styles?.decimalText],
  );

  const showRolling = isMounted && useRolling;

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
      {prefix ? (
        typeof prefix === 'string' ? (
          <Text style={wholeStyle}>{prefix}</Text>
        ) : (
          prefix
        )
      ) : null}
      {showRolling ? (
        <AnimatedRollingNumber
          value={wholeNumber}
          textStyle={wholeStyle}
          spinningAnimationConfig={{ duration: DURATION }}
          useGrouping
        />
      ) : (
        <Text style={wholeStyle}>{formattedWhole}</Text>
      )}
      {decimalPlaces > 0 ? (
        <>
          <Text className={classNames?.decimalSeparator} style={styles?.decimalSeparator}>
            .
          </Text>
          {showRolling ? (
            <AnimatedRollingNumber
              value={Number(formattedText)}
              formattedText={formattedText}
              textStyle={decimalStyle}
              spinningAnimationConfig={{ duration: DURATION }}
            />
          ) : (
            <Text style={decimalStyle}>{formattedText}</Text>
          )}
        </>
      ) : null}
      {suffix ? (
        <Text style={[{ marginLeft: 6 }, wholeStyle, styles?.suffixText]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

export default CountUp;
