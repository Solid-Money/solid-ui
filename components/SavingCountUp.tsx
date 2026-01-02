import { useQueryClient } from '@tanstack/react-query';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TextStyle } from 'react-native';

import CountUp from '@/components/CountUp';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
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
  userDepositTransactions?: GetUserTransactionsQuery;
}

const SavingCountUp = memo(
  ({
    balance,
    apy,
    lastTimestamp,
    mode = SavingMode.TOTAL_USD,
    decimalPlaces = 6,
    classNames,
    styles,
    prefix,
    suffix,
    userDepositTransactions,
  }: SavingCountUpProps) => {
    const [liveYield, setLiveYield] = useState<number>(0);
    const queryClient = useQueryClient();
    const { user } = useUser();

    // Use refs to avoid recreating the interval callback
    const balanceRef = useRef(balance);
    const apyRef = useRef(apy);
    const lastTimestampRef = useRef(lastTimestamp);
    const transactionsRef = useRef(userDepositTransactions);

    // Update refs when props change
    useEffect(() => {
      balanceRef.current = balance;
      apyRef.current = apy;
      lastTimestampRef.current = lastTimestamp;
      transactionsRef.current = userDepositTransactions;
    }, [balance, apy, lastTimestamp, userDepositTransactions]);

    const updateYield = useCallback(async () => {
      const now = Math.floor(Date.now() / 1000);
      const calculatedYield = await calculateYield(
        balanceRef.current,
        apyRef.current,
        lastTimestampRef.current,
        now,
        mode,
        queryClient,
        transactionsRef.current,
        user?.safeAddress,
      );
      setLiveYield(calculatedYield);
    }, [mode, queryClient, user?.safeAddress]);

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
  },
);

SavingCountUp.displayName = 'SavingCountUp';

export default SavingCountUp;
