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
  suffixText?: TextStyle;
};

interface CountUpProps {
  count: number;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  isTrailingZero?: boolean;
  prefix?: string;
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
  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const formattedText = isNaN(Number(trailingZero)) ? '0' : trailingZero;

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
      {prefix ? (
        <Text style={styles?.wholeText}>{prefix}</Text>
      ) : null}
      <AnimatedRollingNumber
        value={wholeNumber}
        textStyle={styles?.wholeText}
        spinningAnimationConfig={{ duration: DURATION }}
        useGrouping
      />
      <Text className={classNames?.decimalSeparator}>.</Text>
      <AnimatedRollingNumber
        value={Number(formattedText)}
        formattedText={formattedText}
        textStyle={styles?.decimalText}
        spinningAnimationConfig={{ duration: DURATION }}
      />
      {suffix ? (
        <Text style={[{ marginLeft: 6 }, styles?.wholeText, styles?.suffixText]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

export default CountUp;
