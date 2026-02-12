import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TextStyle } from 'react-native';

import CountUp from '@/components/CountUp';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, SECONDS_PER_YEAR } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

/** amountGained since lastTs at time now - no fetch. */
function amountGained(
  balance: number,
  exchangeRate: number,
  apy: number,
  lastTs: number,
  now: number,
): number {
  const balanceUSD = balance * exchangeRate;
  return (((apy / 100) * (now - lastTs)) / SECONDS_PER_YEAR) * balanceUSD;
}

/** TOTAL_USD without fetchVaultTransfers - use for 1s tick to avoid explorer requests. */
function totalUsdLive(
  balance: number,
  exchangeRate: number,
  apy: number,
  lastTs: number,
  now: number,
): number {
  const balanceUSD = balance * exchangeRate;
  return balanceUSD + amountGained(balance, exchangeRate, apy, lastTs, now);
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
    const lastYieldRef = useRef<{ value: number; time: number } | null>(null);

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
      lastYieldRef.current = { value: calculatedYield, time: now };
      setLiveYield(calculatedYield);
    }, [mode, user?.safeAddress, tokenAddress, vaultDecimals]);

    // Derive a boolean so the effect re-runs when balance transitions to/from positive,
    // without recreating the interval on every minor balance tick.
    const hasPositiveBalance = balance > 0;

    const tickYield = useCallback(() => {
      const now = Math.floor(Date.now() / 1000);
      const bal = balanceRef.current;
      const rate = exchangeRateRef.current;
      const apyVal = apyRef.current;
      const lastTs = lastTimestampRef.current;
      if (mode === SavingMode.TOTAL_USD) {
        setLiveYield(totalUsdLive(bal, rate, apyVal, lastTs, now));
      } else {
        const last = lastYieldRef.current;
        if (last) {
          const delta =
            amountGained(bal, rate, apyVal, lastTs, now) -
            amountGained(bal, rate, apyVal, lastTs, last.time);
          setLiveYield(last.value + delta);
        }
      }
    }, [mode]);

    useEffect(() => {
      if (balanceRef.current <= 0) {
        setLiveYield(0);
        return;
      }
      updateYield();
      const interval = setInterval(tickYield, 1000);
      return () => clearInterval(interval);
    }, [updateYield, tickYield, hasPositiveBalance]);

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
