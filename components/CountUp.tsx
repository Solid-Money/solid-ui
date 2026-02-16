import React, { useEffect, useState } from 'react';
import { TextStyle, View } from 'react-native';
import { AnimatedRollingNumber } from 'react-native-animated-rolling-numbers';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

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
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const formattedText = isNaN(Number(trailingZero)) ? '0' : trailingZero;

  const formattedWhole = wholeNumber.toLocaleString('en-US');

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
      {prefix ? (
        typeof prefix === 'string' ? (
          <Text style={styles?.wholeText}>{prefix}</Text>
        ) : (
          prefix
        )
      ) : null}
      {isMounted ? (
        <AnimatedRollingNumber
          value={wholeNumber}
          textStyle={styles?.wholeText}
          spinningAnimationConfig={{ duration: DURATION }}
          useGrouping
        />
      ) : (
        <Text style={styles?.wholeText}>{formattedWhole}</Text>
      )}
      {decimalPlaces > 0 ? (
        <>
          <Text className={classNames?.decimalSeparator} style={styles?.decimalSeparator}>
            .
          </Text>
          {isMounted ? (
            <AnimatedRollingNumber
              value={Number(formattedText)}
              formattedText={formattedText}
              textStyle={styles?.decimalText}
                  spinningAnimationConfig={{ duration: DURATION }}
            />
          ) : (
            <Text style={styles?.decimalText}>{formattedText}</Text>
          )}
        </>
      ) : null}
      {suffix ? (
        <Text style={[{ marginLeft: 6 }, styles?.wholeText, styles?.suffixText]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

export default CountUp;
