import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TextStyle } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import CountUp from '@/components/CountUp';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
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
  suffixText?: TextStyle;
};

interface SavingCountUpProps {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  prefix?: string | React.ReactNode;
  suffix?: string;
  userDepositTransactions?: GetUserTransactionsQuery;
  exchangeRate?: number;
  tokenAddress?: string;
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
    exchangeRate = 1,
    tokenAddress = ADDRESSES.fuse.vault,
  }: SavingCountUpProps) => {
    const [liveYield, setLiveYield] = useState<number>(0);
    const queryClient = useQueryClient();
    const { user } = useUser();

    // Use refs to avoid recreating the interval callback
    const balanceRef = useRef(balance);
    const apyRef = useRef(apy);
    const lastTimestampRef = useRef(lastTimestamp);
    const transactionsRef = useRef(userDepositTransactions);
    const exchangeRateRef = useRef(exchangeRate);

    // Update refs when props change
    useEffect(() => {
      balanceRef.current = balance;
      apyRef.current = apy;
      lastTimestampRef.current = lastTimestamp;
      transactionsRef.current = userDepositTransactions;
      exchangeRateRef.current = exchangeRate;
    }, [balance, apy, lastTimestamp, userDepositTransactions, exchangeRate]);

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
        exchangeRateRef.current,
        tokenAddress,
        decimalPlaces,
      );
      setLiveYield(calculatedYield);
    }, [mode, queryClient, user?.safeAddress, tokenAddress, decimalPlaces]);

    useEffect(() => {
      // calculateYield returns 0 immediately when balance <= 0 (financial.ts:325)
      // Skip the interval entirely to avoid unnecessary re-renders
      if (balanceRef.current <= 0) {
        setLiveYield(0);
        return;
      }

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
