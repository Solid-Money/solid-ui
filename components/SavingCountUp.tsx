import { useCallback, useEffect, useState } from 'react';
import { TextStyle } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';
import CountUp from '@/components/CountUp';

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

const SavingCountUp = ({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL_USD,
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

  return (
    <CountUp
      count={liveYield}
      decimalPlaces={decimalPlaces}
      classNames={classNames}
      styles={styles}
    />
  );
};

export default SavingCountUp;
