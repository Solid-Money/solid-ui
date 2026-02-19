import React, { memo } from 'react';
import { TextStyle } from 'react-native';

import CountUp from '@/components/CountUp';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useSavingsYield } from '@/hooks/useSavingsYield';
import { ADDRESSES } from '@/lib/config';
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
  decimals?: number;
  classNames?: ClassNames;
  styles?: Styles;
  prefix?: string | React.ReactNode;
  suffix?: string;
  userDepositTransactions?: GetUserTransactionsQuery;
  exchangeRate?: number;
  tokenAddress?: string;
  /** When true, interest inputs are loaded (avoids stale 0). Pass for CURRENT mode when APY/ts are ready. */
  inputsReady?: boolean;
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
    inputsReady,
  }: SavingCountUpProps) => {
    const liveYield = useSavingsYield({
      balance,
      apy,
      lastTimestamp,
      mode,
      decimals: vaultDecimals,
      userDepositTransactions,
      exchangeRate,
      tokenAddress,
      inputsReady,
    });

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
