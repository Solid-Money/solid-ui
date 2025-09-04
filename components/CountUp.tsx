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
};

interface CountUpProps {
  count: number;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  isTrailingZero?: boolean;
}

const DURATION = 500;

const CountUp = ({
  count,
  decimalPlaces = 6,
  classNames,
  styles,
  isTrailingZero = true,
}: CountUpProps) => {
  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const wholeNumber = Math.floor(safeCount);
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];
  const formattedText = isNaN(Number(trailingZero)) ? '0' : trailingZero;

  return (
    <View className={cn('flex-row items-baseline', classNames?.wrapper)}>
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
    </View>
  );
};

export default CountUp;
