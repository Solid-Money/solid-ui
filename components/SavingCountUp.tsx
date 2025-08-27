import { useCallback, useEffect, useState } from 'react';
import { TextStyle, View } from 'react-native';
import { AnimatedRollingNumber } from 'react-native-animated-rolling-numbers';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

type ClassNames = {
  wrapper?: string;
  decimalSeparator?: string;
};

type Styles = {
  wholeText?: TextStyle;
  decimalText?: TextStyle;
};

interface SavingCountUpProps {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
}

const DURATION = 500;

const SavingCountUp = ({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL,
  decimalPlaces = 6,
  classNames,
  styles,
}: SavingCountUpProps) => {
  const [liveYield, setLiveYield] = useState<number>(0);
  const queryClient = useQueryClient();

  const updateYield = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const calculatedYield = await calculateYield(
      balance,
      apy,
      lastTimestamp,
      now,
      mode,
      queryClient,
    );
    setLiveYield(calculatedYield);
  }, [balance, apy, lastTimestamp, mode, queryClient]);

  useEffect(() => {
    updateYield();
    const interval = setInterval(updateYield, 1000);
    return () => clearInterval(interval);
  }, [updateYield]);

  const safeYield = isFinite(liveYield) && liveYield >= 0 ? liveYield : 0;
  const wholeNumber = Math.floor(safeYield);
  const decimalString = safeYield.toFixed(decimalPlaces);
  const decimalPart = Number(decimalString.split('.')[1] || '0');

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
        value={decimalPart}
        formattedText={decimalPart.toString().padStart(decimalPlaces, '0')}
        textStyle={styles?.decimalText}
        spinningAnimationConfig={{ duration: DURATION }}
      />
    </View>
  );
};

export default SavingCountUp;
