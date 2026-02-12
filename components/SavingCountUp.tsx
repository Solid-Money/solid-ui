import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TextStyle } from 'react-native';

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
  /** Display decimal places for the count-up number */
  decimalPlaces?: number;
  /** Vault token decimals (e.g. 6 for USDC, 18 for FUSE). Used by calculateYield for deposit-history math. Defaults to 6. */
  decimals?: number;
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
    decimals: vaultDecimals = 6,
    classNames,
    styles,
    prefix,
    suffix,
    userDepositTransactions,
    exchangeRate = 1,
    tokenAddress = ADDRESSES.fuse.vault,
  }: SavingCountUpProps) => {
    const [liveYield, setLiveYield] = useState<number>(0);
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
        transactionsRef.current,
        user?.safeAddress,
        exchangeRateRef.current,
        tokenAddress,
        vaultDecimals,
      );
      setLiveYield(calculatedYield);
    }, [mode, user?.safeAddress, tokenAddress, vaultDecimals]);

    // Derive a boolean so the effect re-runs when balance transitions to/from positive,
    // without recreating the interval on every minor balance tick.
    const hasPositiveBalance = balance > 0;

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
    }, [updateYield, hasPositiveBalance]);

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
