import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { TextStyle } from 'react-native';

import CountUp from '@/components/CountUp';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

type ClassNames = {
  wrapper?: string;
  decimalSeparator?: string;
};

type Styles = {
  wholeText?: TextStyle;
  decimalText?: TextStyle;
  decimalSeparator?: TextStyle;
};

interface SavingCountUpProps {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  prefix?: string;
  suffix?: string;
}

const SavingCountUp = ({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL_USD,
  decimalPlaces = 6,
  classNames,
  styles,
  prefix,
  suffix,
}: SavingCountUpProps) => {
  const [liveYield, setLiveYield] = useState<number>(0);
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: userDepositTransactions } = useGetUserTransactionsQuery({
    variables: {
      address: user?.safeAddress?.toLowerCase() ?? '',
    },
  });

  const updateYield = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const calculatedYield = await calculateYield(
      balance,
      apy,
      lastTimestamp,
      now,
      mode,
      queryClient,
      userDepositTransactions,
      user?.safeAddress,
    );
    setLiveYield(calculatedYield);
  }, [balance, apy, lastTimestamp, mode, queryClient, userDepositTransactions, user?.safeAddress]);

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
      prefix={prefix}
      suffix={suffix}
    />
  );
};

export default SavingCountUp;
