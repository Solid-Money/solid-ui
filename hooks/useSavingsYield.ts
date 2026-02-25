import { useEffect, useState } from 'react';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, SECONDS_PER_YEAR } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

function amountGained(
  balance: number,
  exchangeRate: number,
  apy: number,
  fromTs: number,
  toTs: number,
): number {
  const balanceUSD = balance * exchangeRate;
  return (((apy / 100) * (toTs - fromTs)) / SECONDS_PER_YEAR) * balanceUSD;
}

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

export interface UseSavingsYieldParams {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimals?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
  exchangeRate?: number;
  tokenAddress?: string;
  /** When true, treat interest inputs as loaded. Omit to use internal buckets. */
  inputsReady?: boolean;
}

export function useSavingsYield({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL_USD,
  decimals: vaultDecimals = 6,
  userDepositTransactions,
  exchangeRate = 1,
  tokenAddress = ADDRESSES.fuse.vault,
  inputsReady,
}: UseSavingsYieldParams): number {
  const [liveYield, setLiveYield] = useState(0);
  const [tick, setTick] = useState(0);
  const [anchor, setAnchor] = useState<{ value: number; time: number } | null>(null);
  const { user } = useUser();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastTsBucket = lastTimestamp > 0 ? Math.floor(lastTimestamp / 86400) : 0;
  const apyBucket = Math.floor((apy ?? 0) * 100);

  // Full calc only when inputs change (no tick)
  useEffect(() => {
    if (balance <= 0) {
      setLiveYield(0);
      setAnchor(null);
      return;
    }
    let cancelled = false;
    const now = Math.floor(Date.now() / 1000);
    calculateYield(
      balance,
      apy,
      lastTimestamp,
      now,
      mode,
      userDepositTransactions,
      user?.safeAddress,
      exchangeRate,
      tokenAddress,
      vaultDecimals,
    ).then(calculatedYield => {
      if (cancelled) return;
      const isSpuriousZero =
        mode === SavingMode.CURRENT && calculatedYield === 0 && balance > 0 && lastTimestamp > 0;
      if (!isSpuriousZero) {
        setLiveYield(calculatedYield);
        if (mode === SavingMode.CURRENT) setAnchor({ value: calculatedYield, time: now });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    balance,
    apy,
    lastTimestamp,
    mode,
    userDepositTransactions,
    user?.safeAddress,
    exchangeRate,
    tokenAddress,
    vaultDecimals,
    ...(inputsReady !== undefined ? [inputsReady] : [lastTsBucket, apyBucket]),
  ]);

  // Every second: update display with simple formula (no network)
  useEffect(() => {
    if (balance <= 0) return;
    const now = Math.floor(Date.now() / 1000);
    if (mode === SavingMode.TOTAL_USD) {
      setLiveYield(totalUsdLive(balance, exchangeRate, apy, lastTimestamp, now));
    } else if (mode === SavingMode.CURRENT && anchor) {
      setLiveYield(anchor.value + amountGained(balance, exchangeRate, apy, anchor.time, now));
    }
  }, [tick, balance, apy, lastTimestamp, exchangeRate, mode, anchor]);

  return liveYield;
}
